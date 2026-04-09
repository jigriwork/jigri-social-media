import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/reports - create user report
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const entityType = typeof body?.entityType === 'string' ? body.entityType : ''
    const entityId = typeof body?.entityId === 'string' ? body.entityId : null
    const reasonCode = typeof body?.reasonCode === 'string' ? body.reasonCode : ''
    const description = typeof body?.description === 'string' ? body.description : null

    if (!entityType || !reasonCode) {
      return NextResponse.json(
        { error: 'entityType and reasonCode are required' },
        { status: 400 }
      )
    }

    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        reporter_user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        reason_code: reasonCode,
        description,
        status: 'open',
      })
      .select('id, status, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
    }

    // Append report action timeline entry (non-blocking)
    try {
      const adminClient = createAdminClient()
      await adminClient.from('report_actions').insert({
        report_id: report.id,
        actor_user_id: user.id,
        actor_role: 'user',
        action_type: 'report_created',
        reason: reasonCode,
        metadata: { entityType, entityId },
      })
    } catch (timelineError) {
      console.warn('report_actions insert skipped:', timelineError)
    }

    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error('Create report API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
