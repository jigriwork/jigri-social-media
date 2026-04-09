# Jigri Role & Permission Audit

Date: 2026-04-09

---

## 1) Effective role types that exist today

From code and behavior, these are the practical roles:

1. **Guest (unauthenticated)**
   - Can view selected public/shared routes.
   - Cannot perform social actions; gets auth prompt.

2. **Normal authenticated user**
   - Can manage own profile/posts.
   - Can like/save/comment/follow and receive notifications.

3. **Admin (binary `is_admin` + hardcoded bypass checks)**
   - Access to admin dashboard.
   - Can manage users/posts and admin membership.

4. **“Initial admin” pseudo-super-admin (hardcoded emails)**
   - Implemented via `INITIAL_ADMIN_EMAILS = ['owner@jigri.app', 'admin@jigri.app']`.
   - Treated specially in add/remove admin workflows.

---

## 2) Is there a true super-admin role?

**No (not schema-backed).**

What exists is a **hardcoded email-based super-admin behavior**, not a first-class permission model:
- No dedicated `role` enum/table with hierarchy.
- No scoped permission matrix.
- No immutable root admin identity model.
- No signed audit policy for privilege changes.

---

## 3) How admin is granted today

Path:
- Admin uses Admin Dashboard -> `AdminManagement` -> `addAdminUser(email)`.
- `addAdminUser` checks `checkAdminAccess()` then sets target user `is_admin=true`.
- Target must already have user row/account.

Constraints:
- Admin can’t remove self.
- Initial hardcoded admins cannot be removed.

Risks:
- Hardcoded email trust is brittle.
- No approval chain / no dual-control for privilege escalation.
- No audit log table for who granted what and when.

---

## 4) What admin can do today

### Admin can
- Open `/admin` if access check passes.
- View platform stats.
- Add admin user by email.
- Remove admin from non-initial admin users.
- View paginated users and user state.
- Activate/deactivate non-admin users.
- View paginated posts and delete any post.

### Admin cannot (today)
- Reset/change another user password from admin panel.
- Create users directly from admin panel.
- Delete users hard from auth + data with robust transactional flow.
- Manage role scopes (moderator/content admin/support admin etc.).
- Access moderation queue/report pipeline.
- Issue verified badges/trust levels.
- See complete forensic audit logs.

---

## 5) Safety assessment of current admin model

## Strengths
- There is at least a gate (`checkAdminAccess`) and admin-only UI segmentation.
- Self-admin removal and initial-admin removal are blocked.
- Non-admin deactivation is restricted against peer-admin deactivation.

## Risks
1. **Role model simplicity** (binary admin) is insufficient for scaling org responsibilities.
2. **Hardcoded initial admin emails** create deployment/config drift risk.
3. **Client-side heavy permission reliance** (component-level gate) + permissive middleware increases exposure if a route/action is missed.
4. **No central policy engine / no permission claims**.
5. **No audit/event log requirement** for sensitive admin actions.
6. **Legacy duplicate API behavior** (some user deactivation paths mutate email in old route, newer path uses status flags).

Overall safety: **moderate risk for growth stage**.

---

## 6) Hardcoded admin references found

- In `src/lib/supabase/api.ts`:
  - `INITIAL_ADMIN_EMAILS = ['owner@jigri.app', 'admin@jigri.app']`
- In admin UI component logic (`AdminManagement.tsx`) same initial admin assumptions used for badge/removal protection.

This confirms hardcoded privileged identity assumptions are embedded in code.

---

## 7) Powers requested in audit checklist (status)

| Capability | Status today |
|---|---|
| User editing by admin | Partial (status toggle + role changes; no full profile edit console) |
| User deactivation | Yes |
| User deletion | Partial/risky (post delete exists; user hard-delete workflow absent; legacy route behavior unsafe) |
| Password changing by admin | No |
| User creation by admin | No |
| Verification/tickmark system | No |

---

## 8) What is required to safely build “super admin is god of app”

Minimum safe blueprint:

1. **Role schema redesign**
   - `roles` table (`super_admin`, `admin`, `moderator`, `user`).
   - `user_roles` mapping with timestamps and grantor.
   - Optional `permissions` + `role_permissions` for fine-grained scopes.

2. **Supabase RLS + RPC enforcement**
   - Put sensitive admin actions behind SECURITY DEFINER RPCs with strict checks.
   - Never rely only on client checks for destructive operations.

3. **Privileged action audit log**
   - `admin_audit_logs` with actor, action, target, before/after, IP/user-agent, timestamp.
   - Mandatory write on every admin mutation.

4. **Protected root admin model**
   - Non-removable bootstrap super-admin seeded via secure DB migration, not app hardcode.
   - Break-glass recovery procedure documented.

5. **Least privilege segmentation**
   - Super admin: role grants, system config, full destructive ops.
   - Admin: user lifecycle + content control (no role hierarchy changes unless delegated).
   - Moderator: content/report enforcement only.
   - User: normal social capabilities.

6. **Operational controls**
   - Confirmation + reason required for destructive actions.
   - Optional dual-approval for high-risk actions.
   - Metrics and alerting on admin activity.

---

## 9) Recommended separation: super admin vs admin vs moderator vs user

## Super Admin
- Manage all roles and permissions.
- Manage all admins/moderators.
- Global user and content actions.
- System-level settings (policy, trust, verification).
- Full audit log visibility.

## Admin
- User lifecycle (deactivate/reactivate, sanctions), except protected super-admin accounts.
- Content management and escalated moderation actions.
- Operational analytics visibility.

## Moderator
- Review reported posts/comments/users.
- Content takedown/restore within moderation scope.
- No role grants, no sensitive account operations.

## User
- Standard social/product capabilities only.

---

## Verdict

Current permissions are **good enough for MVP/Beta operations** but **not yet safe for serious multi-role expansion** without schema-backed roles, hardened RLS/RPC policy, and mandatory audit logs.
