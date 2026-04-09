import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isBootstrapSuperAdminEmail } from './constants'

export type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin'

const ROLE_RANK: Record<AppRole, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  super_admin: 3,
}

function isValidRole(value: unknown): value is AppRole {
  return value === 'user' || value === 'moderator' || value === 'admin' || value === 'super_admin'
}

export function normalizeRole(role: unknown, isAdmin?: boolean | null): AppRole {
  if (isValidRole(role)) return role
  return isAdmin ? 'admin' : 'user'
}

export function hasMinRole(role: AppRole, minRole: AppRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

export function canManageTargetRole(actorRole: AppRole, targetRole: AppRole): boolean {
  if (actorRole !== 'super_admin') return false
  if (targetRole === 'super_admin') return false
  return true
}

export type GovernanceContext = {
  authenticated: boolean
  userId: string | null
  email: string | null
  role: AppRole
  hasAdminAccess: boolean
  isBootstrapProtected: boolean
}

export async function getCurrentGovernanceContext(): Promise<GovernanceContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      authenticated: false,
      userId: null,
      email: null,
      role: 'user',
      hasAdminAccess: false,
      isBootstrapProtected: false,
    }
  }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('id, email, role, is_admin')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role, profile?.is_admin)
  const email = profile?.email || user.email || null
  const isBootstrapProtected = role === 'super_admin' && isBootstrapSuperAdminEmail(email)

  return {
    authenticated: true,
    userId: user.id,
    email,
    role,
    hasAdminAccess: hasMinRole(role, 'admin'),
    isBootstrapProtected,
  }
}

export async function requireMinRole(minRole: AppRole) {
  const context = await getCurrentGovernanceContext()
  if (!context.authenticated || !hasMinRole(context.role, minRole)) {
    throw new Error('Access denied. Insufficient role privileges.')
  }
  return context
}

export async function getUserGovernanceById(userId: string) {
  const adminClient = createAdminClient()
  const { data: user } = await adminClient
    .from('users')
    .select('id, email, role, is_admin, is_deactivated')
    .eq('id', userId)
    .single()

  if (!user) return null

  const role = normalizeRole(user.role, user.is_admin)
  const isBootstrapProtected = role === 'super_admin' && isBootstrapSuperAdminEmail(user.email)

  return {
    ...user,
    role,
    isBootstrapProtected,
  }
}

export async function getSuperAdminCount(): Promise<number> {
  const adminClient = createAdminClient()
  const { count } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'super_admin')

  return count || 0
}

export async function logGovernanceAudit(event: {
  actionType: string
  targetType: string
  targetId?: string | null
  reason?: string | null
  metadata?: Record<string, any>
  beforeSnapshot?: Record<string, any> | null
  afterSnapshot?: Record<string, any> | null
}) {
  try {
    const context = await getCurrentGovernanceContext()
    if (!context.userId) return

    const adminClient = createAdminClient()
    await adminClient.from('governance_audit_log').insert({
      actor_user_id: context.userId,
      actor_role: context.role,
      action_type: event.actionType,
      target_type: event.targetType,
      target_id: event.targetId || null,
      reason: event.reason || null,
      metadata: event.metadata || {},
      before_snapshot: event.beforeSnapshot || null,
      after_snapshot: event.afterSnapshot || null,
    })
  } catch (error) {
    // Non-blocking until migration is applied in all environments
    console.warn('governance audit log write skipped:', error)
  }
}
