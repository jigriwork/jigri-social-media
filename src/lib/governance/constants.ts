export const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'admin@jigri.in'

export function isBootstrapSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL
}
