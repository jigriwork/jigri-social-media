import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logGovernanceAudit, requireMinRole } from '@/lib/governance/server'

type AppStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'needs_resubmission'
  | 'withdrawn'

const REASON_REQUIRED_ACTIONS = new Set<AppStatus>(['rejected', 'revoked', 'needs_resubmission'])

function statusToAuditAction(status: AppStatus) {
  switch (status) {
    case 'approved':
      return 'verification_approved'
    case 'rejected':
      return 'verification_rejected'
    case 'needs_resubmission':
      return 'verification_resubmission_requested'
    case 'revoked':
      return 'verification_revoked'
    default:
      return 'verification_status_changed'
  }
}

function isStatusTransitionAllowed(from: AppStatus, to: AppStatus) {
  const allowed: Record<AppStatus, AppStatus[]> = {
    draft: ['submitted', 'withdrawn'],
    submitted: ['under_review', 'withdrawn', 'approved', 'rejected', 'needs_resubmission'],
    under_review: ['approved', 'rejected', 'needs_resubmission', 'withdrawn'],
    approved: ['revoked'],
    rejected: ['submitted'],
    revoked: [],
    needs_resubmission: ['submitted', 'withdrawn'],
    withdrawn: ['submitted'],
  }

  return allowed[from]?.includes(to) ?? false
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  try {
    await requireMinRole('moderator')

    const adminClient = createAdminClient()
    const [{ data: application, error: appError }, { data: events, error: eventsError }] = await Promise.all([
      adminClient
        .from('verification_applications')
        .select(
          `
          *,
          applicant:users!verification_applications_applicant_user_id_fkey(
            id,
            name,
            username,
            image_url,
            is_verified,
            verification_badge_type,
            verification_status,
            verification_updated_at
          ),
          reviewer:users!verification_applications_reviewed_by_user_id_fkey(
            id,
            name,
            username
          ),
          final_decider:users!verification_applications_final_decision_by_user_id_fkey(
            id,
            name,
            username
          )
        `
        )
        .eq('id', resolvedParams.id)
        .single(),
      adminClient
        .from('verification_application_events')
        .select('*')
        .eq('application_id', resolvedParams.id)
        .order('created_at', { ascending: false }),
    ])

    if (appError || !application) {
      return NextResponse.json({ error: 'Verification application not found' }, { status: 404 })
    }

    if (eventsError) {
      return NextResponse.json({ error: 'Failed to fetch verification events' }, { status: 500 })
    }

    return NextResponse.json({ application, events: events || [] })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied. Moderator privileges required.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params

  try {
    const actor = await requireMinRole('moderator')
    const body = await request.json().catch(() => ({} as any))

    const nextStatus = body?.status as AppStatus | undefined
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const reviewNotes = typeof body?.reviewNotes === 'string' ? body.reviewNotes.trim() : null
    const requestedBadgeType = body?.badgeType as 'verified' | 'official' | undefined

    if (!nextStatus) {
      return NextResponse.json({ error: 'Next status is required' }, { status: 400 })
    }

    if (REASON_REQUIRED_ACTIONS.has(nextStatus) && !reason) {
      return NextResponse.json({ error: 'Reason is required for this verification action' }, { status: 400 })
    }

    if (nextStatus === 'approved' && requestedBadgeType && !['verified', 'official'].includes(requestedBadgeType)) {
      return NextResponse.json({ error: 'Invalid badge type' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: existing, error: fetchError } = await adminClient
      .from('verification_applications')
      .select('*')
      .eq('id', resolvedParams.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Verification application not found' }, { status: 404 })
    }

    const fromStatus = existing.status as AppStatus

    if (fromStatus === nextStatus) {
      return NextResponse.json({ error: 'Application is already in the requested status' }, { status: 400 })
    }

    if (!isStatusTransitionAllowed(fromStatus, nextStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${fromStatus} to ${nextStatus}` },
        { status: 400 }
      )
    }

    if ((nextStatus === 'approved' || nextStatus === 'rejected' || nextStatus === 'revoked') && actor.role === 'moderator') {
      return NextResponse.json(
        { error: 'Moderators can triage but cannot finalize verification decisions' },
        { status: 403 }
      )
    }

    if (nextStatus === 'revoked' && actor.role !== 'admin' && actor.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only admin or super admin can revoke verification' }, { status: 403 })
    }

    if ((nextStatus === 'approved' || nextStatus === 'revoked') && actor.role === 'admin' && body?.forceOverride === true) {
      return NextResponse.json({ error: 'Only super admin can force override decisions' }, { status: 403 })
    }

    const nowIso = new Date().toISOString()
    const updatePayload: Record<string, any> = {
      status: nextStatus,
      reviewed_by_user_id: actor.userId,
      reviewed_at: nowIso,
      updated_at: nowIso,
      review_notes: reviewNotes ?? existing.review_notes,
      rejection_reason_code:
        nextStatus === 'rejected' || nextStatus === 'needs_resubmission' || nextStatus === 'revoked'
          ? reason || existing.rejection_reason_code
          : null,
    }

    if (nextStatus === 'approved' || nextStatus === 'rejected' || nextStatus === 'revoked') {
      updatePayload.active = nextStatus === 'approved'
      if (actor.role === 'super_admin' || body?.forceOverride === true) {
        updatePayload.final_decision_by_user_id = actor.userId
        updatePayload.final_decision_at = nowIso
      }
    }

    if (nextStatus === 'needs_resubmission' || nextStatus === 'withdrawn') {
      updatePayload.active = false
    }

    const { data: updated, error: updateError } = await adminClient
      .from('verification_applications')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Failed to update verification application' }, { status: 500 })
    }

    const applicantUserId = existing.applicant_user_id
    const approvedBadge = requestedBadgeType || existing.requested_badge_type || 'verified'

    if (nextStatus === 'approved') {
      await adminClient
        .from('users')
        .update({
          is_verified: true,
          verification_badge_type: approvedBadge,
          verification_status: 'verified',
          verification_updated_at: nowIso,
        })
        .eq('id', applicantUserId)
    } else if (nextStatus === 'revoked') {
      await adminClient
        .from('users')
        .update({
          is_verified: false,
          verification_badge_type: null,
          verification_status: 'revoked',
          verification_updated_at: nowIso,
        })
        .eq('id', applicantUserId)
    } else if (nextStatus === 'rejected' || nextStatus === 'needs_resubmission' || nextStatus === 'withdrawn') {
      await adminClient
        .from('users')
        .update({
          is_verified: false,
          verification_badge_type: null,
          verification_status: nextStatus === 'withdrawn' ? 'none' : 'pending',
          verification_updated_at: nowIso,
        })
        .eq('id', applicantUserId)
    }

    await adminClient.from('verification_application_events').insert({
      application_id: existing.id,
      actor_user_id: actor.userId,
      actor_role: actor.role,
      event_type:
        actor.role === 'super_admin' && body?.forceOverride === true
          ? 'override'
          : nextStatus === 'approved'
            ? 'approved'
            : nextStatus === 'rejected'
              ? 'rejected'
              : nextStatus === 'revoked'
                ? 'revoked'
                : 'status_changed',
      from_status: fromStatus,
      to_status: nextStatus,
      reason: reason || null,
      metadata: {
        review_notes: reviewNotes || null,
        requested_badge_type: approvedBadge,
        force_override: body?.forceOverride === true,
      },
    })

    await logGovernanceAudit({
      actionType:
        actor.role === 'super_admin' && body?.forceOverride === true
          ? 'verification_super_admin_override'
          : statusToAuditAction(nextStatus),
      targetType: 'verification_application',
      targetId: existing.id,
      reason: reason || null,
      metadata: {
        applicant_user_id: applicantUserId,
        actor_role: actor.role,
        requested_badge_type: approvedBadge,
        force_override: body?.forceOverride === true,
      },
      beforeSnapshot: {
        status: fromStatus,
        reviewed_by_user_id: existing.reviewed_by_user_id,
        final_decision_by_user_id: existing.final_decision_by_user_id,
      },
      afterSnapshot: {
        status: updated.status,
        reviewed_by_user_id: updated.reviewed_by_user_id,
        final_decision_by_user_id: updated.final_decision_by_user_id,
      },
    })

    return NextResponse.json({ success: true, application: updated })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied. Moderator privileges required.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
