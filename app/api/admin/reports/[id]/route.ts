import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logGovernanceAudit, requireMinRole } from '@/lib/governance/server'

const VALID_STATUS = ['open', 'triaged', 'in_review', 'resolved', 'dismissed', 'escalated'] as const

// PATCH /api/admin/reports/[id] - update moderation status/assignment (moderator+)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params

  try {
    const actor = await requireMinRole('moderator')
    const body = await request.json().catch(() => ({} as any))

    const nextStatus = body?.status as string | undefined
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const assignToSelf = body?.assignToSelf === true
    const resolutionNote = typeof body?.resolutionNote === 'string' ? body.resolutionNote : null

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required for moderation actions' }, { status: 400 })
    }

    if (nextStatus && !VALID_STATUS.includes(nextStatus as (typeof VALID_STATUS)[number])) {
      return NextResponse.json({ error: 'Invalid report status' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: existing, error: fetchError } = await adminClient
      .from('reports')
      .select('*')
      .eq('id', resolvedParams.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (nextStatus) {
      updatePayload.status = nextStatus
      if (nextStatus === 'resolved' || nextStatus === 'dismissed') {
        updatePayload.resolved_at = new Date().toISOString()
      }
    }

    if (assignToSelf && actor.userId) {
      updatePayload.assigned_to_user_id = actor.userId
    }

    if (resolutionNote) {
      updatePayload.resolution_note = resolutionNote
    }

    const { data: updated, error: updateError } = await adminClient
      .from('reports')
      .update(updatePayload)
      .eq('id', resolvedParams.id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
    }

    await adminClient.from('report_actions').insert({
      report_id: resolvedParams.id,
      actor_user_id: actor.userId,
      actor_role: actor.role,
      action_type: nextStatus ? `report_status_${nextStatus}` : 'report_update',
      reason,
      metadata: {
        assignToSelf,
        resolutionNote,
      },
    })

    await logGovernanceAudit({
      actionType: 'moderation_report_update',
      targetType: 'report',
      targetId: resolvedParams.id,
      reason,
      beforeSnapshot: {
        status: existing.status,
        assigned_to_user_id: existing.assigned_to_user_id,
      },
      afterSnapshot: {
        status: updated.status,
        assigned_to_user_id: updated.assigned_to_user_id,
      },
    })

    return NextResponse.json({ success: true, report: updated })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied. Moderator privileges required.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
