import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logGovernanceAudit } from '@/lib/governance/server'

const RESUBMIT_COOLDOWN_DAYS = 7

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const action = body?.action as 'withdraw' | 'resubmit' | undefined
    const evidencePayload = sanitizeEvidencePayload(body?.evidencePayload)

    if (!action || (action !== 'withdraw' && action !== 'resubmit')) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const [{ data: actorProfile }, { data: existing, error: existingError }] = await Promise.all([
      adminClient.from('users').select('id, role').eq('id', user.id).single(),
      adminClient
        .from('verification_applications')
        .select('*')
        .eq('id', resolvedParams.id)
        .eq('applicant_user_id', user.id)
        .single(),
    ])

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Verification application not found' }, { status: 404 })
    }

    const actorRole = (actorProfile?.role || 'user') as 'user' | 'moderator' | 'admin' | 'super_admin'
    const nowIso = new Date().toISOString()

    if (action === 'withdraw') {
      if (!['submitted', 'under_review', 'needs_resubmission'].includes(existing.status)) {
        return NextResponse.json({ error: 'Application cannot be withdrawn in current status' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await adminClient
        .from('verification_applications')
        .update({
          status: 'withdrawn',
          active: false,
          updated_at: nowIso,
        })
        .eq('id', existing.id)
        .eq('applicant_user_id', user.id)
        .select('*')
        .single()

      if (updateError || !updated) {
        return NextResponse.json({ error: 'Failed to withdraw verification application' }, { status: 500 })
      }

      await adminClient.from('users').update({ verification_status: 'none', verification_updated_at: nowIso }).eq('id', user.id)

      await adminClient.from('verification_application_events').insert({
        application_id: existing.id,
        actor_user_id: user.id,
        actor_role: actorRole,
        event_type: 'withdrawn',
        from_status: existing.status,
        to_status: 'withdrawn',
        metadata: {},
      })

      await logGovernanceAudit({
        actionType: 'verification_status_changed',
        targetType: 'verification_application',
        targetId: existing.id,
        metadata: { action: 'withdraw' },
        beforeSnapshot: { status: existing.status, active: existing.active },
        afterSnapshot: { status: updated.status, active: updated.active },
      })

      return NextResponse.json({ success: true, application: updated })
    }

    if (!['needs_resubmission', 'rejected'].includes(existing.status)) {
      return NextResponse.json({ error: 'Application is not eligible for resubmission' }, { status: 400 })
    }

    if (
      existing.status === 'rejected' &&
      existing.cooldown_until &&
      new Date(existing.cooldown_until).getTime() > Date.now()
    ) {
      return NextResponse.json(
        { error: `Resubmission is on cooldown until ${new Date(existing.cooldown_until).toISOString()}` },
        { status: 429 }
      )
    }

    const nextEvidence =
      Object.keys(evidencePayload).length > 0
        ? evidencePayload
        : existing.evidence_payload

    if (!hasRequiredSupportingEvidence(nextEvidence || {})) {
      return NextResponse.json(
        { error: 'Supporting document reference is required (reference ID or reference URL).' },
        { status: 400 }
      )
    }

    if (existing.application_type !== 'person' && existing.requested_badge_type === 'official') {
      return NextResponse.json(
        { error: 'Only person applications can request the official badge.' },
        { status: 400 }
      )
    }

    if (existing.requested_badge_type === 'official') {
      if (!hasOfficialCategory(nextEvidence || {})) {
        return NextResponse.json(
          { error: 'Please select the official role/category for this application.' },
          { status: 400 }
        )
      }

      if (!hasOfficialDocument(nextEvidence || {})) {
        return NextResponse.json(
          { error: 'Official badge applications require a document upload.' },
          { status: 400 }
        )
      }
    }

    const { data: updated, error: updateError } = await adminClient
      .from('verification_applications')
      .update({
        status: 'submitted',
        active: true,
        evidence_payload: nextEvidence,
        resubmission_count: (existing.resubmission_count || 0) + 1,
        reviewed_by_user_id: null,
        reviewed_at: null,
        review_notes: null,
        rejection_reason_code: null,
        final_decision_by_user_id: null,
        final_decision_at: null,
        cooldown_until:
          existing.status === 'rejected' ? addDaysIso(RESUBMIT_COOLDOWN_DAYS) : null,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .eq('applicant_user_id', user.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Failed to resubmit verification application' }, { status: 500 })
    }

    await adminClient.from('users').update({ verification_status: 'pending', verification_updated_at: nowIso }).eq('id', user.id)

    await adminClient.from('verification_application_events').insert({
      application_id: existing.id,
      actor_user_id: user.id,
      actor_role: actorRole,
      event_type: 'resubmitted',
      from_status: existing.status,
      to_status: 'submitted',
      metadata: {
        resubmission_count: updated.resubmission_count,
        evidence_keys: Object.keys(nextEvidence || {}),
      },
    })

    await logGovernanceAudit({
      actionType: 'verification_status_changed',
      targetType: 'verification_application',
      targetId: existing.id,
      metadata: { action: 'resubmit', resubmission_count: updated.resubmission_count },
      beforeSnapshot: { status: existing.status, resubmission_count: existing.resubmission_count },
      afterSnapshot: { status: updated.status, resubmission_count: updated.resubmission_count },
    })

    return NextResponse.json({ success: true, application: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
