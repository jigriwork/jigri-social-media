# Jigri Technical Foundation & Risk Audit

Date: 2026-04-09

---

## 1) Architecture snapshot

Framework stack:
- Next.js app router (`app/` routes)
- React + TanStack Query client data layer
- Supabase (auth, database, storage, realtime)

Core layers observed:
- UI routes: `app/*`
- Legacy/feature UI modules: `src/_root/pages/*`
- API/data logic: `src/lib/supabase/api.ts` (very large and central)
- Admin APIs: `app/api/admin/*`
- Auth/context: `src/context/SupabaseAuthContext.tsx`

---

## 2) Project structure quality

## Strengths
- Clear domain folders for auth/social/admin routes.
- Reusable shared components are substantial.
- Query key discipline exists via `queryKeys.ts`.

## Risks
1. **Dual-architecture residue** (Next app router + legacy react-router references in `src/_root/pages`).
2. **Duplicate page/components for same domain** (e.g., profile/post forms/details variants) -> behavior drift risk.
3. **Monolithic API utility file** (`src/lib/supabase/api.ts`) centralizes too much product logic.

---

## 3) Routing/security structure audit

- `middleware.ts` currently allows all routes (`NextResponse.next()` effectively everywhere).
- Route protection is mostly done at component/API function level.

Risk impact:
- Easy to miss a guard on a new route or action.
- Security posture depends on every leaf handler being correct.

Severity: **High for long-term expansion**.

---

## 4) State/query layer audit

Observed:
- Query client configured with retries, offlineFirst network mode.
- Mutation/query hooks are comprehensive.

Strengths:
- Good UX responsiveness and cached interactions.
- Refetch on reconnect/focus improves consistency.

Risks:
- Heavy client orchestration for critical logic (feed merge/scoring, admin action coordination).
- Invalidations and optimistic transitions are somewhat uneven.
- Can lead to eventual stale behavior under concurrency.

---

## 5) Supabase client/server/admin architecture

Components:
- Browser client (`src/lib/supabase/client.ts`)
- Server client with cookies (`src/lib/supabase/server.ts`)
- Admin/service-role client (`src/lib/supabase/admin.ts`)

Strengths:
- Correct separation primitives exist.
- Env var checks are present.

Risks:
1. Service-role fallback usage in public API requires strict discipline.
2. Role/permission decisions often sit in app logic rather than database-first policy design.
3. Hardcoded privileged identity list for initial admins.

---

## 6) API routes audit

Implemented route groups:
- Admin stats/users/posts APIs.
- Public profile API.

Strengths:
- Dedicated endpoints reduce some client-side overreach.

Risks:
- Legacy inconsistency: user deactivation in `/api/admin/users/[id]` DELETE path mutates email to soft-delete marker, while broader app uses explicit status fields.
- No centralized error-contract typing for API responses.

---

## 7) Notification architecture audit

Current design:
- `notifications` table + realtime subscription.
- Notification service singleton handles inserts and listeners.

Strengths:
- Full end-to-end trigger coverage for core social actions.

Risks:
- Notification creation done from client paths can produce race/duplication edge cases despite duplicate guards.
- Missing centralized server-side event bus/worker architecture for scale.

---

## 8) Feed logic audit

Current behavior:
- Following feed combines followed posts + own posts + fallback recent public posts with score sorting.

Strengths:
- Better user experience than strict empty-follow feed.

Risks:
- Query/mix logic in app layer (not materialized ranking backend).
- Scalability pressure as dataset grows (sorting/fallback composition at runtime).

---

## 9) Onboarding logic audit

Current:
- Checklist computed from user profile + follow count + post count.

Strength:
- Strong activation UX.

Risk:
- No explicit persistent onboarding state machine/events; hard to analyze funnel deeply later.

---

## 10) Admin logic audit

Current:
- `is_admin` bool + hardcoded initial admin emails.

Risk:
- Not sufficient for multi-tier governance and least privilege.
- No immutable admin audit stream.

---

## 11) Storage/media handling audit

Observed:
- Media uploads to Supabase storage bucket `posts` with 2MB limit.
- FileUploader handles type/size rejection client-side.

Risks:
- Strict cap may degrade UX for modern photo expectations.
- File name/path governance and signed URL lifecycle strategy is basic.

---

## 12) Monolithic files / technical debt hotspots

High-complexity candidates:
- `src/lib/supabase/api.ts` (core data + admin + auth-adjacent logic all in one module)
- `src/context/SupabaseAuthContext.tsx` (session lifecycle complexity)
- `src/components/shared/QuickComment.tsx` (very large UI+state+actions)

Impact:
- Slower onboarding for new developers.
- Higher regression probability during feature expansion.

---

## 13) Security risks summary

1. Permissive middleware route policy.
2. Hardcoded initial super-admin emails.
3. Incomplete server-enforced role hierarchy.
4. Limited audit trails for sensitive admin actions.
5. Mixed legacy and new behavior paths for admin mutations.

---

## 14) Performance/scalability risks summary

1. Client-heavy feed composition and ranking.
2. Multiple refetch-heavy patterns in interaction-rich components.
3. Large components with frequent state updates.
4. No dedicated background processing for high-volume notifications/moderation events.

---

## 15) Naming/confusion/dead-code risks

- Duplicate feature components with overlapping responsibilities.
- Legacy `react-router-dom` remnants in a Next.js app.
- Multiple post/profile form variants.

---

## 16) Documentation status

Strength:
- Several audit/setup SQL docs exist in root.

Gaps:
- No single authoritative architecture map of runtime data flow.
- No role/permission policy contract doc.
- No admin action governance playbook.

---

## 17) Foundation readiness verdict

**Current foundation is strong enough for Beta iteration, but not yet hardened for large-scale role/verification/admin expansion.**

Before next major expansion, prioritize:
1) Role model hardening (schema + RLS + audit logs)
2) Middleware/security policy normalization
3) Refactoring monolithic/duplicate components
4) Admin moderation workflow foundation
