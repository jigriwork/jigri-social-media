import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logGovernanceAudit } from '@/lib/governance/server'

const APPLICATION_TYPES = ['person', 'creator', 'organization'] as const
const BADGE_TYPES = ['verified', 'official'] as const

function isValidApplicationType(value: unknown): value is (typeof APPLICATION_TYPES)[number] {
  return APPLICATION_TYPES.includes(value as (typeof APPLICATION_TYPES)[number])
}

function isValidBadgeType(value: unknown): value is (typeof BADGE_TYPES)[number] {
  return BADGE_TYPES.includes(value as (typeof BADGE_TYPES)[number])
}

function sanitizeEvidencePayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const source = value as Record<string, unknown>
  const allowedKeys = [
    'document_type',
    'document_country',
    'reference_id',
    'reference_url',
    'document_url',
    'document_name',
    'notes',
    'official_category',
    'official_title',
  ]
  const sanitized: Record<string, unknown> = {}

  for (const key of allowedKeys) {
    const nextValue = source[key]
    if (typeof nextValue === 'string') {
      sanitized[key] = nextValue.trim().slice(0, 400)
    }
  }

  return sanitized
}

function hasRequiredSupportingEvidence(payload: Record<string, unknown>) {
  const referenceId = typeof payload.reference_id === 'string' ? payload.reference_id.trim() : ''
  const referenceUrl = typeof payload.reference_url === 'string' ? payload.reference_url.trim() : ''
  return Boolean(referenceId || referenceUrl)
}

function hasOfficialDocument(payload: Record<string, unknown>) {
  const documentUrl = typeof payload.document_url === 'string' ? payload.document_url.trim() : ''
  return Boolean(documentUrl)
}

function hasOfficialCategory(payload: Record<string, unknown>) {
  const officialCategory = typeof payload.official_category === 'string' ? payload.official_category.trim() : ''
  return Boolean(officialCategory)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: applications, error } = await adminClient
      .from('verification_applications')
      .select('*')
      .eq('applicant_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch verification applications' }, { status: 500 })
    }

    return NextResponse.json({ applications: applications || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const applicationType = body?.applicationType
    const requestedBadgeType = body?.requestedBadgeType
    const evidencePayload = sanitizeEvidencePayload(body?.evidencePayload)

    if (!isValidApplicationType(applicationType)) {
      return NextResponse.json({ error: 'Invalid application type' }, { status: 400 })
    }

    if (!isValidBadgeType(requestedBadgeType)) {
      return NextResponse.json({ error: 'Invalid requested badge type' }, { status: 400 })
    }

    if (!hasRequiredSupportingEvidence(evidencePayload)) {
      return NextResponse.json(
        { error: 'Supporting document reference is required (reference ID or reference URL).' },
        { status: 400 }
      )
    }

    if (applicationType !== 'person' && requestedBadgeType === 'official') {
      return NextResponse.json(
        { error: 'Only person applications can request the official badge.' },
        { status: 400 }
      )
    }

    if (requestedBadgeType === 'official') {
      if (!hasOfficialCategory(evidencePayload)) {
        return NextResponse.json(
          { error: 'Please select the official role/category for this application.' },
          { status: 400 }
        )
      }

      if (!hasOfficialDocument(evidencePayload)) {
        return NextResponse.json(
          { error: 'Official badge applications require a document upload.' },
          { status: 400 }
        )
      }
    }

    const adminClient = createAdminClient()

    const [{ data: actorProfile }, { data: activeApplication }, { data: latestRejected }] = await Promise.all([
      adminClient.from('users').select('id, role').eq('id', user.id).single(),
      adminClient
        .from('verification_applications')
        .select('id, status, active')
        .eq('applicant_user_id', user.id)
        .eq('active', true)
        .maybeSingle(),
      adminClient
        .from('verification_applications')
        .select('id, cooldown_until, status')
        .eq('applicant_user_id', user.id)
        .eq('status', 'rejected')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (activeApplication) {
      return NextResponse.json(
        { error: 'You already have an active verification application.' },
        { status: 409 }
      )
    }

    if (latestRejected?.cooldown_until && new Date(latestRejected.cooldown_until).getTime() > Date.now()) {
      return NextResponse.json(
        { error: `Resubmission is on cooldown until ${new Date(latestRejected.cooldown_until).toISOString()}` },
        { status: 429 }
      )
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('verification_applications')
      .insert({
        applicant_user_id: user.id,
        status: 'submitted',
        application_type: applicationType,
        requested_badge_type: requestedBadgeType,
        evidence_payload: evidencePayload,
        active: true,
      })
      .select('*')
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: 'Failed to submit verification application' }, { status: 500 })
    }

    await adminClient.from('verification_application_events').insert({
      application_id: inserted.id,
      actor_user_id: user.id,
      actor_role: (actorProfile?.role || 'user') as 'user' | 'moderator' | 'admin' | 'super_admin',
      event_type: 'submitted',
      from_status: null,
      to_status: 'submitted',
      metadata: {
        application_type: applicationType,
        requested_badge_type: requestedBadgeType,
        evidence_keys: Object.keys(evidencePayload),
      },
    })

    await adminClient
      .from('users')
      .update({
        verification_status: 'pending',
        verification_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    await logGovernanceAudit({
      actionType: 'verification_application_submitted',
      targetType: 'verification_application',
      targetId: inserted.id,
      metadata: {
        applicant_user_id: user.id,
        application_type: applicationType,
        requested_badge_type: requestedBadgeType,
        evidence_keys: Object.keys(evidencePayload),
      },
      afterSnapshot: {
        status: inserted.status,
        active: inserted.active,
      },
    })

    return NextResponse.json({ success: true, application: inserted })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
