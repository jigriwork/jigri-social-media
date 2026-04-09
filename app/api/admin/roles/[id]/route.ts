import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSuperAdminCount, getUserGovernanceById, logGovernanceAudit, requireMinRole } from '@/lib/governance/server'

type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin'

// PATCH /api/admin/roles/[id] - change role by user id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params

  try {
    const actor = await requireMinRole('admin')
    const body = await request.json().catch(() => ({} as any))
    const role = body?.role as AppRole
    const reason = typeof body?.reason === 'string' ? body.reason : 'Role update'

    if (!['user', 'moderator', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (actor.userId === resolvedParams.id && role !== actor.role) {
      return NextResponse.json({ error: 'Cannot modify your own role' }, { status: 400 })
    }

    const target = await getUserGovernanceById(resolvedParams.id)
    if (!target) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    if (target.isBootstrapProtected && role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot demote protected bootstrap super admin' }, { status: 400 })
    }

    if ((target.role === 'admin' || role === 'admin' || target.role === 'super_admin' || role === 'super_admin') && actor.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can manage admin/super-admin roles' }, { status: 403 })
    }

    if (target.role === 'super_admin' && role !== 'super_admin') {
      const superAdminCount = await getSuperAdminCount()
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last super admin' }, { status: 400 })
      }
    }

    if (target.role === role) {
      return NextResponse.json({ success: true, message: 'Role already assigned', role })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', resolvedParams.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    await logGovernanceAudit({
      actionType: 'role_change',
      targetType: 'user',
      targetId: resolvedParams.id,
      reason,
      beforeSnapshot: { role: target.role },
      afterSnapshot: { role },
    })

    return NextResponse.json({ success: true, role })
  } catch (error) {
    console.error('Admin role patch API error:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied. Admin privileges required.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
