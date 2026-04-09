import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserGovernanceById, logGovernanceAudit, requireMinRole } from '@/lib/governance/server'

type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin'

// POST /api/admin/roles - assign role by email
export async function POST(request: NextRequest) {
  try {
    const actor = await requireMinRole('admin')
    const body = await request.json().catch(() => ({} as any))
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
    const role = body?.role as AppRole
    const reason = typeof body?.reason === 'string' ? body.reason : 'Role assignment'

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!['user', 'moderator', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if ((role === 'admin' || role === 'super_admin') && actor.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can assign admin/super-admin roles' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, email, role, is_admin')
      .eq('email', email)
      .single()

    if (error || !targetUser) {
      return NextResponse.json({ error: 'Target user not found. User must sign up first.' }, { status: 404 })
    }

    const targetGovernance = await getUserGovernanceById(targetUser.id)
    if (!targetGovernance) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    if (targetGovernance.isBootstrapProtected && role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot demote protected bootstrap super admin' }, { status: 400 })
    }

    if (targetGovernance.role === 'admin' && actor.role !== 'super_admin' && role !== 'admin') {
      return NextResponse.json({ error: 'Only super admin can demote an admin user' }, { status: 403 })
    }

    if (targetGovernance.role === role) {
      return NextResponse.json({ success: true, message: 'Role already assigned', role })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', targetUser.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to assign role' }, { status: 500 })
    }

    await logGovernanceAudit({
      actionType: 'role_change',
      targetType: 'user',
      targetId: targetUser.id,
      reason,
      beforeSnapshot: {
        role: targetGovernance.role,
      },
      afterSnapshot: {
        role,
      },
      metadata: {
        targetEmail: targetUser.email,
      },
    })

    return NextResponse.json({ success: true, userId: targetUser.id, role })
  } catch (error) {
    console.error('Admin role assign API error:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied. Admin privileges required.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
