# PHASE 4A — Super Admin Governance + Role Hardening + Scalable Admin Architecture (Planning Only)

## 0) Scope, constraints, and non-negotiables

This document is a **planning-only architecture pass** for Jigri governance hardening.

### Hard constraints followed
- No blind implementation in this pass.
- No second role system.
- No parallel super-admin model.
- No duplicate admin checks or duplicate dashboards.
- Existing admin system must be **evolved**, not replaced in parallel.
- Protected bootstrap super admin identity target: **`admin@jigri.in`**.

---

## 1) Deep audit of current role/admin implementation (actual codebase)

## 1.1 Current source of truth today

Current privilege model is effectively:
- `users.is_admin` boolean in DB (real schema)
- plus hardcoded email allowlist (`owner@jigri.app`, `admin@jigri.app`) in client/server app logic

This means there is no single formal role hierarchy yet; there is a binary admin gate plus pseudo-super-admin behavior.

### Primary schema evidence
- `supabase_jigri_bootstrap.sql`
  - `public.users.is_admin BOOLEAN NOT NULL DEFAULT false`
  - helper functions: `public.is_admin_user(uuid)`, `public.is_current_user_admin()`

### Types evidence
- `src/lib/supabase/database.types.ts`
  - user row contains `is_admin`, no role enum/table model.

---

## 1.2 Where admin checks currently happen

## A) Central API helper layer (but client-side Supabase client)
- `src/lib/supabase/api.ts`
  - `INITIAL_ADMIN_EMAILS = ['owner@jigri.app', 'admin@jigri.app']`
  - `isInitialAdmin()`
  - `isUserAdmin()` => true if in initial list OR DB `is_admin=true`
  - `checkAdminAccess()` => uses `supabase.auth.getUser()` + `isUserAdmin`
  - Admin ops (`addAdminUser`, `removeAdminUser`, `getAdminStats`, user/post management) depend on `checkAdminAccess()`

## B) UI access gating
- `src/_root/pages/AdminDashboard.tsx`
  - blocks view by `useCheckAdminAccess()`
- `src/components/shared/LeftSidebar.tsx`
  - shows `/admin` link only if `useCheckAdminAccess()` true
- `src/components/shared/Topbar.tsx`
  - shows admin button only if `useCheckAdminAccess()` true

## C) API routes
- `app/api/admin/stats/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/admin/posts/route.ts`
- `app/api/admin/posts/[id]/route.ts`

All above use `checkAdminAccess()` imported from `src/lib/supabase/api.ts`.

---

## 1.3 Current hardcoded pseudo-super-admin behavior

### Hardcoded allowlist locations
- `src/lib/supabase/api.ts` (`INITIAL_ADMIN_EMAILS`)
- `src/components/shared/AdminManagement.tsx`
  - Protects those emails from removal
  - Labels those emails as “Super Admin” in UI

### Problem
Pseudo-super-admin behavior is duplicated in both logic and UI, using fixed strings. This is fragile and non-scalable.

---

## 1.4 Current admin dashboard + dependency map

### Route + page
- `/admin` -> `app/admin/page.tsx` -> `src/_root/pages/AdminDashboard.tsx`

### Dashboard modules
- `AdminManagement` (grant/revoke admin)
- `AdminUserManagement` (user activation/deactivation + post deletion)

### React-query hooks
- `useCheckAdminAccess`, `useGetAdminStats`, `useGetAdminUsers`, `useAddAdminUser`, `useRemoveAdminUser`
- `useGetAdminAllUsers`, `useToggleUserActivation`, `useGetAdminAllPosts`, `useAdminDeletePost`

### Important transition impact points
Role model changes affect:
1. All calls to `checkAdminAccess()`
2. Any UI checks of `is_admin`
3. Admin-management guard logic (self-removal, protected accounts)
4. RLS helper functions currently based on `is_admin`

---

## 1.5 Existing security posture risks relevant to phase 4A

1. Middleware is permissive (`middleware.ts` allows all routes, relies on downstream checks).
2. Privilege checks are largely app-helper driven, not fully DB-governed.
3. Hardcoded super-admin identity is repeated in multiple places.
4. Legacy inconsistency exists in `/api/admin/users/[id]` DELETE path (email mutation soft-delete style) versus newer `is_deactivated` flow.
5. No immutable, first-class privileged action log yet.

---

## 2) Target role architecture (single unified model, no duplication)

## 2.1 Target roles
- `super_admin`
- `admin`
- `moderator`
- `user`

## 2.2 Architecture choice for Jigri

### Chosen model
**Canonical role enum on `public.users`** (single-role) for Phase 4 foundation.

Proposed column:
- `users.role` enum: `user | moderator | admin | super_admin`

### Why this is best for Jigri now
1. **Directly compatible** with current single-flag model (`is_admin`).
2. **Low migration risk**: one table to migrate, no many-to-many joins required.
3. **No duplicate systems**: role lives where `is_admin` already lives.
4. **Fast policy rewrite** for existing RLS helpers.
5. Supports next phase trust/verification flows cleanly.

### Not chosen now (and why)
- Separate `roles` + `user_roles` (multi-role): more flexible but unnecessary complexity for current stage and migration risk.
- Full permission table in phase 4A: useful later, but role-based capabilities are enough now and safer for transition.

### Forward-compatible extension (planned, not required immediately)
Add optional capability map later (for fine-grained exceptions) **without replacing** role enum as source of truth.

---

## 2.3 Role capability boundaries (practical)

## Super Admin
Can:
- Grant/revoke all privileged roles (including admin/moderator/super_admin under safety policy)
- Manage admin/moderator roster
- Deactivate/reactivate any non-protected account
- Perform controlled account recovery operations
- Access governance/audit panels and all privileged logs
- Configure policy knobs for moderation + trust system foundations

Cannot:
- Remove/lock bootstrap super-admin identity without break-glass protocol

## Admin
Can:
- User lifecycle ops (deactivate/reactivate normal users)
- Content ops (delete/restore/takedown where policy allows)
- Operational dashboard access and queues

Cannot:
- Grant/revoke `super_admin`
- Modify bootstrap protections
- Manage platform-level policy settings

## Moderator
Can:
- Handle reports and moderation queue
- Take scoped content actions (hide/takedown/escalate)
- Add moderation notes and reasons

Cannot:
- Manage roles
- Manage user account security actions
- Access governance settings

## User
Standard non-privileged behavior only.

---

## 3) Migration strategy (no breakage, no duplicate role systems)

This is the primary risk area. Strategy is phased to preserve current behavior while moving to single canonical role.

## 3.1 Phase M0 — Freeze and inventory (done via this planning audit)
- Enumerate all role checks and hardcoded email checks.
- Identify legacy API behavior to normalize.

## 3.2 Phase M1 — Introduce canonical role column (compatibility mode)

Add `users.role` with default `user`.

Initial backfill mapping:
- if `is_admin = true` => `role = 'admin'`
- else `role = 'user'`

Set **`admin@jigri.in`** role to `super_admin` once account exists.

Compatibility rule during M1:
- Keep `is_admin` column temporarily.
- Treat `is_admin` as **derived compatibility field**, not authoritative.
- Synchronization rule:
  - `is_admin = (role IN ('admin','super_admin'))`

Use DB trigger or centralized service mutation path to keep consistency during transition window.

## 3.3 Phase M2 — Centralize checks

Replace `checkAdminAccess()` internals to read canonical role (via server-safe endpoint/function), not hardcoded email list.

Keep existing function names during transition to avoid broad app breakage:
- `checkAdminAccess()` remains public API for existing callers.
- Internally map to `role in ('admin','super_admin','moderator?')` depending on endpoint requirement.

Endpoint-specific checks become explicit:
- admin endpoints: `role in ('admin','super_admin')`
- moderator endpoints: `role in ('moderator','admin','super_admin')`
- super-admin endpoints: `role = 'super_admin'`

## 3.4 Phase M3 — Remove duplicated hardcoded logic

Deprecate/remove:
- `INITIAL_ADMIN_EMAILS` checks in app code
- UI-local hardcoded super-admin checks in `AdminManagement.tsx`

Replace with centralized role + protection API response fields.

## 3.5 Phase M4 — Deprecate legacy boolean path

After all checks and RLS migrate successfully:
- stop reading `is_admin` in app code
- optionally retain `is_admin` generated/compat column for a short release window
- then remove column in later hardening release (only after full confidence)

---

## 4) Bootstrap super-admin architecture (`admin@jigri.in`)

## 4.1 Design goals
- No scattered hardcoded checks.
- Centralized bootstrap policy.
- No accidental lockout.
- Migration-safe if account does not yet exist at migration time.

## 4.2 Planned design

Create centralized governance config source (single-row table or protected setting function), e.g.:
- `governance_settings.bootstrap_super_admin_email = 'admin@jigri.in'`

Then create one server/DB helper:
- `is_bootstrap_super_admin(user_id)`

It should:
1. Resolve user email from `users`.
2. Normalize lowercase and compare against governance setting.
3. Return boolean.

No other code path should compare raw emails directly.

## 4.3 Bootstrap safety constraints
- Bootstrap super-admin cannot be demoted/deactivated/deleted by non-super users.
- Self-demotion and self-deactivation protection enabled for all privileged users.
- “last super_admin cannot be removed” invariant.
- break-glass recovery documented (manual SQL procedure, restricted and audited).

---

## 5) Super admin powers planning (safe, highest authority)

Planned super_admin control domains:
1. **Role governance**
   - assign/revoke admin/moderator roles
   - assign additional super_admin (if policy allows)
2. **User governance**
   - edit user operational profile fields
   - deactivate/reactivate users
   - controlled reset flow initiation
3. **Content governance**
   - global content takedown/restore authority
4. **Governance visibility**
   - full privileged audit log access
   - moderation queue oversight
5. **Future trust/verification control**
   - approve/reject/revoke verification states
6. **System governance actions**
   - policy toggles and safety config management (through controlled endpoints)

All above require:
- reason capture for sensitive actions
- immutable logs
- server-side enforcement only

---

## 6) Admin vs moderator planning (least privilege)

## Admin (operations)
- User management (excluding protected super-admin operations)
- Content moderation actions
- Access to broader operational stats and queues

## Moderator (content/report focused)
- Process reports
- Hide/takedown/escalate content
- User warning/sanction recommendation (not direct role changes)

## Boundary rules
- Moderator cannot change roles.
- Moderator cannot perform account security operations.
- Admin cannot alter super-admin governance settings unless explicitly super_admin.

---

## 7) Audit log architecture plan

## 7.1 Core table
`governance_audit_log`

Recommended fields:
- `id uuid pk`
- `created_at timestamptz`
- `actor_user_id uuid`
- `actor_role text`
- `action_type text` (normalized taxonomy)
- `target_type text` (`user`, `post`, `report`, `verification_case`, `system_setting`, etc.)
- `target_id uuid/null`
- `reason text` (required for sensitive actions)
- `metadata jsonb` (request context, policy refs)
- `before_snapshot jsonb` (where feasible and safe)
- `after_snapshot jsonb`
- `request_id text` / `trace_id text`
- `ip_hash text` and `user_agent text` (if available in server routes)
- `is_rollbackable boolean`

## 7.2 Must-log events (minimum)
- role grant/revoke
- user deactivation/reactivation
- privileged profile edits
- admin/moderator content takedown/restore/delete
- report decision actions
- verification decisions (future-ready)
- security-sensitive config changes

## 7.3 Snapshot rules
- For destructive or high-risk mutation: store before+after snapshots.
- For very large payloads: include redacted subset + metadata pointer.
- Never log plaintext secrets.

## 7.4 Access to logs
- read: super_admin (full), admin (scoped as policy decides)
- write: only server-side privileged flows
- immutable: no update/delete except strict retention jobs with policy

---

## 8) Moderation/reporting foundation plan (MVP before scale)

## 8.1 Core entities

### `reports`
- `id`, `created_at`, `reporter_user_id`
- `entity_type` (`post`, `comment`, `profile`, `message` future)
- `entity_id`
- `reason_code` (enum-like text)
- `description`
- `status` (`open`, `triaged`, `in_review`, `resolved`, `dismissed`, `escalated`)
- `priority` (`low`, `normal`, `high`, `critical`)
- `assigned_to_user_id` (moderator/admin)
- `resolved_at`, `resolution_code`, `resolution_note`

### `report_actions`
- immutable timeline of every action on a report
- includes actor, action, reason, metadata

## 8.2 Workflow
1. user submits report
2. enters queue as `open`
3. moderator/admin claims assignment
4. action taken (content hide/escalate/dismiss)
5. close with reason and action history

## 8.3 Role relation
- moderator: primary queue workers
- admin: can override and handle escalations
- super_admin: full oversight and policy tuning

---

## 9) Verification/trust foundation hooks (for phase 4B)

No blue-tick implementation now, only groundwork.

## 9.1 Minimal schema hooks to plan now

### `user_trust_profile` (or extend users with careful names)
- `trust_level` (default baseline)
- `verification_status` (`none`, `pending`, `verified`, `rejected`, `revoked`)
- `verification_updated_at`

### `verification_requests`
- requester, status, submitted evidence references, reviewer, decision reason

### `verification_actions`
- audit timeline for verification decisions

## 9.2 Why now
Prevents rework by ensuring role/governance APIs can later authorize verification decisions cleanly (`admin`/`super_admin` policy controlled).

---

## 10) Security enforcement design (authoritative backend, UI only for UX)

## 10.1 Enforcement layering

1. **DB schema + constraints**
   - canonical role enum
   - invariant checks (last super-admin guard)

2. **RLS + helper functions**
   - replace binary `is_current_user_admin()` with role-aware helpers
   - e.g., `has_minimum_role('admin')`, `has_role('super_admin')`

3. **RPC / server actions for privileged mutations**
   - role changes
   - deactivation
   - sensitive moderation actions
   - each requires reason + writes audit log

4. **API route protection**
   - all `/api/admin/*` and future `/api/moderation/*` use server-side role resolver
   - no trust in client-side flags

5. **Middleware**
   - can optionally route-gate `/admin` for UX
   - but middleware is NOT sole authority; backend remains source of truth

6. **Client-side gating**
   - keep for discoverability UX only
   - never treated as security boundary

## 10.2 Required hardening corrections in transition
- Stop importing client-oriented privilege helper for server route decisions.
- Create dedicated server privilege utility (shared by all admin/mod endpoints).
- Normalize legacy `/api/admin/users/[id]` DELETE behavior to standard deactivation fields.

---

## 11) Dashboard evolution plan (no duplicate dashboard)

Keep single `/admin` dashboard route and evolve sectionally.

## 11.1 What stays
- Existing `/admin` shell and route
- Existing stats and management views as base modules

## 11.2 What upgrades
- Role-aware sections in same dashboard:
  - **Operations** (admin + super_admin)
  - **Moderation Queue** (moderator + admin + super_admin)
  - **Governance** (super_admin only)
  - **Audit Logs** (super_admin full, admin scoped)

## 11.3 No-duplication rule
- No separate “super-admin app.”
- No parallel `/super-admin` dashboard requirement.
- Use one dashboard with conditional modules and strict backend checks.

---

## 12) Deprecation plan (what is retained vs removed)

## Retain during transition
- `is_admin` temporarily for compatibility.
- Existing React-query hook signatures (`useCheckAdminAccess`, etc.)
- Existing `/admin` route + components.

## Deprecate
- `INITIAL_ADMIN_EMAILS` hardcoded arrays.
- UI hardcoded super-admin email checks.
- any direct logic relying on `is_admin` as primary authority.
- legacy user deactivation via email mutation approach.

## Final retained authority
- canonical `users.role` + centralized governance helper functions.

---

## 13) Duplicate role-system risk prevention (explicit controls)

1. One canonical role source: `users.role`.
2. `is_admin` temporary compatibility only; auto-derived and removed later.
3. One privilege resolver utility used by:
   - API routes
   - server actions/RPC
   - dashboard data loaders
4. No email checks outside centralized bootstrap resolver.
5. One dashboard route with role-based sections; no duplicated dashboards.

---

## 14) Implementation-readiness checklist for next phase

Ready to implement once approved, with this order:
1. Add role enum + backfill + compatibility mapping.
2. Add governance settings/bootstrap resolver for `admin@jigri.in`.
3. Centralize server role-check utility.
4. Refactor existing admin endpoints to role-aware checks.
5. Introduce immutable governance audit logging for privileged mutations.
6. Add moderation report queue foundation tables + APIs.
7. Upgrade dashboard modules in-place (no new dashboard tree).
8. Remove hardcoded email checks and complete deprecation window.

---

## 15) Executive summary

Jigri currently has a workable binary admin foundation (`is_admin`) with hardcoded pseudo-super-admin behavior. The safest scalable path is to evolve to a **single canonical role enum on `users`** (`user/moderator/admin/super_admin`) while keeping temporary `is_admin` compatibility to prevent breakage. Bootstrap identity should be centralized via governance settings with protected `admin@jigri.in` handling, not scattered hardcoded checks. Existing `/admin` stays as one dashboard and gains role-aware sections. Privileged operations become server-enforced with immutable audit logs and a moderation/report queue foundation, preparing Phase 4B verification expansion without structural rework.
