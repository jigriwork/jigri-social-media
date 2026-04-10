# JIGRI SUPER SYSTEM AUDIT — ALL COMBINED

## 1. System overview

Jigri is currently a **hybrid / transitional social app** that has been partially migrated from a React SPA architecture to a Next.js App Router architecture.

At a high level, the system works like this:

- **Frontend runtime:** Next.js 15 App Router (`app/`) with many client components.
- **Legacy app layer still present:** large parts of the old SPA remain under `src/_root`, `src/_auth`, and related components, including direct `react-router-dom` usage.
- **Auth + data backend:** Supabase Auth, Supabase Postgres, Supabase Storage, and Supabase Realtime.
- **Data access pattern:** a large client-heavy API layer in `src/lib/supabase/api.ts` performs direct Supabase reads/writes from the browser for most social features.
- **Server/API layer:** Next.js route handlers under `app/api/**` exist mainly for governance/admin/reporting/verification/public fallback use cases.
- **State/query management:** React Query is used broadly.
- **Authorization model:** mixed. Normal social features rely heavily on client-side Supabase + RLS; governance/admin flows rely on server routes and service-role admin client.

### Internal architecture truth

There are effectively **two architectures coexisting**:

1. **Current Next.js layer**
   - `app/layout.tsx`
   - `app/**/page.tsx`
   - `app/api/**`
   - `next/navigation`

2. **Legacy SPA layer**
   - `src/_root/ClientLayoutWrapper.tsx` uses `BrowserRouter`
   - `src/_root/RootLayout.tsx` uses `Navigate` + `Outlet`
   - `src/_auth/AuthLayout.tsx` uses `react-router-dom`
   - multiple pages/components still import `react-router-dom`

This split is the root of several product and routing inconsistencies.

---

## 2. Feature matrix

| Area | Status | Truth from code |
|---|---|---|
| Next.js app shell | Implemented | `app/` routes exist for sign-in, profile, posts, explore, admin, etc. |
| Legacy SPA remnants | Still present | `src/_root/*`, `src/_auth/*`, several files still use `react-router-dom` |
| Auth with Supabase | Implemented | `SupabaseAuthContext`, `signInUser`, `signUpUser`, session listeners |
| Auth persistence | Implemented but fragile | Supabase session + localStorage cache (`jigri_user`, `jigri_auth`) |
| User profile bootstrap | Implemented | `ensureUserProfile()` auto-creates missing `users` row |
| Posts | Implemented | create/read/update/delete flows exist |
| Likes | Implemented | likes table + mutations exist |
| Comments + replies | Implemented | comments + parent_id + comment likes exist |
| Saves | Implemented | save/unsave/query exists |
| Follows | Implemented | follow/unfollow/query exists |
| Feed | Implemented but not scalable | mixed client-side ranking/filtering in `getFollowingFeed()` |
| Explore/search posts | Implemented at MVP level | `searchPosts()` and explore page exist |
| User search | Implemented | `searchUsers()` exists |
| Notifications backend table | Implemented | SQL bootstrap includes `notifications` + realtime publication |
| Notifications creation | Partially implemented | created from client mutation flows, not DB triggers |
| Notifications UI | Implemented but fragmented | `NotificationBell`, `NotificationPopup`, `NotificationContext`, `notificationService` |
| Reports / moderation queue | Implemented | `app/api/reports`, `app/api/admin/reports/**` |
| Admin stats/dashboard | Implemented | `app/api/admin/stats`, admin pages/components |
| Role system | Implemented | `user`, `moderator`, `admin`, `super_admin` in governance layer |
| Verification system | Implemented with guardrails | schema + queue + status transitions + audit events |
| Governance audit log | Implemented but migration-dependent | server logs non-blocking if table absent |
| Settings/account | Partial | privacy settings exist; broader settings surface is not evident in `app/` |
| PWA | Not implemented | no manifest, no SW, no install flow |
| Offline mode | Not implemented as PWA | only incidental browser/query caching |

---

## 3. What is fully implemented

### 3.1 Core authentication foundation

Implemented evidence:

- `src/context/SupabaseAuthContext.tsx`
- `src/lib/supabase/api.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`

What exists:

- Sign-up via Supabase Auth.
- Sign-in via password.
- Sign-out.
- Session initialization from Supabase.
- Auth state change handling (`SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`).
- Password reset/update flows exist in API layer and route/pages.
- Missing profile rows are auto-created by `ensureUserProfile()`.

This is one of the more mature foundations in the app.

### 3.2 Social primitives

Implemented evidence in `src/lib/supabase/api.ts`:

- post CRUD
- likes
- saves
- follows
- comments
- comment likes
- user post queries
- public post/profile helper queries

Database evidence in `supabase_bootstrap_core.sql` and `supabase_jigri_bootstrap.sql`:

- tables for `posts`, `likes`, `saves`, `follows`, `comments`, `comment_likes`, `notifications`
- indexes on the main relationship columns
- RLS policies for each major social table

### 3.3 Governance / admin baseline

Implemented evidence:

- `src/lib/governance/server.ts`
- `app/api/admin/stats/route.ts`
- `app/api/admin/reports/**`
- `app/api/admin/verification/**`
- phase 4A SQL migration

What exists:

- role normalization
- minimum-role enforcement
- audit log writing
- admin stats
- moderation queue access
- verification queue access

### 3.4 Verification system core

Implemented evidence:

- `phase4b_verification_trust_migration.sql`
- `app/api/verification/route.ts`
- `app/api/admin/verification/route.ts`
- `app/api/admin/verification/[id]/route.ts`
- `src/components/shared/AdminVerificationTrust.tsx`
- `src/components/shared/VerificationBadge.tsx`

What exists:

- verification application schema
- application event timeline schema
- one-active-application constraint
- queue retrieval
- detailed reviewer view
- status transition enforcement
- reviewer / finalizer restrictions
- badge assignment to `users`
- audit logging hooks
- front-end badge rendering

This is materially implemented, not just mocked.

---

## 4. What is partially implemented

### 4.1 Notifications system

The notifications system exists, but it is **not cleanly production-complete**.

Implemented:

- notifications table + realtime publication in SQL bootstrap
- UI bell dropdown in `src/components/shared/NotificationBell.tsx`
- popup/manager/context/service files
- creation flows for new post / like / follow / comment in `src/lib/utils/notificationService.ts`

Partial / weak points:

- notifications are generated from **client-side mutation success paths**, not authoritative server/database triggers
- duplicate logic exists between `NotificationBell` direct querying and `NotificationContext`/`notificationService`
- bell UI and popup system are overlapping implementations
- no evidence of robust server-side guaranteed delivery model

Conclusion: **usable MVP**, not hardened production notification architecture.

### 4.2 Search system

Implemented:

- `searchPosts()`
- `searchUsers()`
- Explore page search UI

Missing / weak:

- no advanced ranking/search index/search service
- broad ilike queries on Supabase tables
- no clear universal/global search surface for app-wide entities
- no evidence of search for tags/users/posts combined in a single search product

Conclusion: **basic search exists**, but it is not mature.

### 4.3 Settings / account system

Implemented:

- privacy settings component (`PrivacySettings.tsx`)
- password reset/update routes/pages
- profile update pages exist

Missing:

- no dedicated comprehensive settings architecture visible in `app/`
- account preferences, notification preferences, security sessions, deletion/export flows are not evident as a cohesive module

Conclusion: **partial**.

### 4.4 Public profile/post access fallback

Public routes exist in middleware and helper APIs exist, but the system is still compensating for mixed auth/RLS/public-access complexity rather than expressing a clean public-access architecture.

---

## 5. What is broken

### 5.1 Routing architecture is broken at foundation level

This is the biggest architectural issue.

Evidence:

- `src/_root/ClientLayoutWrapper.tsx` still uses `BrowserRouter`
- `src/_root/RootLayout.tsx` still uses `Navigate` and `Outlet`
- `src/_auth/AuthLayout.tsx` still uses `react-router-dom`
- search results show many remaining `react-router-dom` imports
- current app also uses `app/` routes and `next/navigation`

This means the codebase is operating as an **incomplete migration**, not a clean Next.js app.

### 5.2 QueryProvider/AuthProvider are duplicated in route-level layouts

Evidence:

- `app/layout.tsx` already wraps app with `QueryProvider` + `AuthProvider`
- `app/components/AppLayout.tsx` wraps again with `QueryProvider` + `AuthProvider`
- `app/sign-in/page.tsx` wraps again with `QueryProvider` + `AuthProvider`

This can create:

- duplicated providers
- auth/query state fragmentation
- unnecessary remounting
- inconsistent behavior between routes

### 5.3 Middleware does not truly protect anything

Evidence from `middleware.ts`:

- comments explicitly state auth is handled at component level
- all protected routes effectively `NextResponse.next()`

So current middleware is mostly pass-through and not a true security boundary.

### 5.4 Client-side notification generation is unreliable by design

Because notification creation happens in client mutation success handlers, notifications can be skipped if:

- browser logic fails
- client disconnects
- mutation response path changes
- alternate write path bypasses those hooks

This is a product/system correctness issue.

### 5.5 Delete post path in post detail is incomplete in UI

Evidence in `app/posts/[id]/page.tsx`:

- `handleDeletePost()` only does `router.back()` and includes comment `Add delete post functionality here`

So delete affordance exists but the actual behavior is unfinished in this page.

### 5.6 PWA is absent

Evidence:

- `public/` has no manifest
- no service worker registration found
- no install prompt handling found

So PWA readiness is functionally **not implemented**.

---

## 6. What is missing but expected

1. **Cleanly finished Next.js migration**
2. **Single routing system**
3. **Server-driven or DB-trigger-driven notifications**
4. **Real settings/account center**
5. **Robust search architecture**
6. **PWA manifest/service worker/install flow**
7. **Server-authoritative feed strategy for scale**
8. **More complete moderation action tooling on target entities**
9. **Clear security boundary between UI convenience and actual authorization**
10. **Operational observability / monitoring / error reporting evidence**

---

## 7. App architecture deep audit

### 7.1 Folder structure reality

- `app/` = Next.js routes and route handlers
- `src/_root` / `src/_auth` = legacy page/layout system
- `src/lib/supabase/api.ts` = giant browser-side service layer doing too much
- `app/api/**` = selective server APIs, especially admin/verification/report/public fallbacks

This is not clean separation. It is a **migration-in-progress architecture living in production**.

### 7.2 Client vs server responsibility

Current state:

- most social reads/writes are **client-heavy**
- admin and governance use **server routes + service role**
- auth protection for pages is largely **component-side redirect logic**, not server enforcement

Impact:

- weak SSR consistency
- difficult to reason about security boundaries
- duplicated logic between server/client/public/admin flows

### 7.3 API structure

The API structure is mostly targeted around sensitive flows:

- `/api/reports`
- `/api/verification`
- `/api/admin/*`
- `/api/public/*`

This is reasonable for governance-sensitive operations, but the rest of the product still bypasses a unified application API model.

---

## 8. Auth system audit

### What is good

- Supabase session integration is real.
- Session refresh listeners exist.
- Missing profile row recovery exists.
- Deactivated-user check on sign-in exists.

### What is risky

- `SupabaseAuthContext` mixes **Supabase session truth** with **localStorage cached user truth**.
- There is an 8-second loading timeout that force-recovers auth state.
- Multiple providers across routes can create split auth contexts.
- Some route access behavior depends on client redirect after mount, not server-side guard.

### Security/auth gap summary

- **identity is real**
- **authorization is uneven**
- **UX state restoration is complex and fragile**

---

## 9. Database / Supabase audit

### Core tables found in SQL bootstrap/migrations

- users
- posts
- likes
- saves
- follows
- comments
- comment_likes
- notifications
- reports
- report_actions
- governance_audit_log
- verification_applications
- verification_application_events

### Good signs

- foreign keys are used heavily
- follow uniqueness and self-follow prevention exist
- comment reply model uses `parent_id`
- notification table indexed by `user_id`, `created_at`, `read`
- verification has unique active-app constraint and event log

### Risks

1. **Schema drift risk**
   - code contains migration-safe fallbacks (example: missing `role` column handling), which suggests not all environments are guaranteed consistent.

2. **Public read policies are broad**
   - likes, saves, follows, comments often allow public read.
   - may be acceptable for counts/social graph visibility, but increases metadata exposure.

3. **Feed logic depends on pulling large record sets to client/query layer**
   - not scalable.

4. **Notification correctness is application-generated, not DB-guaranteed**
   - risk of missing or duplicate records.

5. **Verification documents stored in `posts` bucket**
   - from `uploadVerificationDocument()`
   - indicates storage model reuse instead of dedicated secure verification-doc bucket.

This is a major trust/privacy concern.

---

## 10. Social core system audit

### Posts

Implemented and functional. But:

- uploads are handled client-side
- file size limit exists in app code only for create flow
- post query patterns fetch full relational payloads repeatedly

### Feed generation logic

`getFollowingFeed()` is the clearest scalability warning.

What it does:

- fetch followed user IDs
- fetch up to 200 followed/own posts
- fetch up to 250 global recent posts
- client-side filter privacy
- fetch comments for candidate posts
- compute engagement score client-side
- mix followed/global content client-side
- paginate after building combined array

Why this is risky:

- heavy client/data transfer cost
- poor scalability for 10k/100k users
- ranking logic tied to browser/app layer
- pagination is not true source-of-truth pagination

### Likes/comments/saves/follows

These primitives are functionally present, but the pattern is very CRUD-oriented and browser-driven. It works at MVP scale, not at serious social scale.

---

## 11. Notifications system status

### Actual status

**Partially implemented and user-visible, but not production-hardened.**

### Backend truth

- notifications table exists
- realtime publication exists
- reads and updates exist
- generation is done in app code, mostly via client mutation success callbacks

### UI truth

- bell dropdown exists
- popup notification system exists
- unread count exists
- realtime subscription exists

### Gaps

- not authoritative server-side generation
- overlapping implementations (`NotificationBell` vs `NotificationContext` + `notificationService`)
- likely inconsistency risks in unread state / popup state / duplicate handling

Conclusion: **good MVP foundation, not yet reliable production notification architecture**.

---

## 12. Verification system deep explanation

### Schema correctness

Strong points:

- user-level fast badge fields on `users`
- separate application table
- separate event log table
- active application uniqueness
- status constraints/indexes

### Workflow correctness

Implemented flow:

- user submits application
- supporting evidence sanitized
- active application conflict checked
- cooldown respected for rejected applications
- application inserted
- event inserted
- user verification status moved to pending
- governance audit log attempted

Admin workflow:

- moderator can view queue/details
- moderator can triage
- moderator cannot finalize approval/rejection/revoke
- only super admin or appointed reviewer can finalize
- status transition validation enforced
- event + audit log recorded
- users table updated with badge / verification status

### Risks

1. Verification docs are uploaded to the `posts` storage bucket.
2. Public URL generation is used for uploaded verification documents.
3. Final-decision policy is partly env-driven via `VERIFICATION_REVIEWER_EMAILS`, which is operationally brittle.
4. Super admin auto-self-healing to verified/official in governance context is convenient but unusual from audit purity perspective.

Overall: **functionally impressive, but storage/privacy model needs hardening.**

---

## 13. Admin + super admin system deep explanation

### Role model

Roles found:

- `user`
- `moderator`
- `admin`
- `super_admin`

Governance helpers in `src/lib/governance/server.ts` provide:

- role normalization
- rank comparison
- minimum-role enforcement
- bootstrap protection logic
- audit logging

### Protection model

Sensitive routes use:

- `requireMinRole('moderator')`
- `requireMinRole('admin')`

This is good for server endpoints.

### Loopholes / risks

1. Main app route protection is not server-enforced by middleware.
2. Some legacy/older admin checks still rely on `is_admin` compatibility and email/user checks.
3. Codebase carries both role-based and legacy-admin compatibility logic, increasing complexity and migration drift risk.

Conclusion: **server-side governance layer is solid**, but the wider app still reflects transitional auth/authorization design.

---

## 14. Moderation system audit

### What exists

- user report creation endpoint
- reports table
- report actions table
- admin/moderator queue
- report status update flow
- assignment to self
- audit logging

### What is missing / partial

- no evidence of deep enforcement workflows against all entity types from a single moderation console
- no evidence of abuse heuristics / rate limiting / automated detection
- moderation appears operationally manual

Conclusion: **foundationally present, operationally basic**.

---

## 15. UI system audit

### Strengths

- componentized structure exists
- shared components are fairly extensive
- admin/verification UI exists beyond stub level

### Weaknesses

1. duplicate page/component generations from SPA-to-Next migration
2. inconsistent architectural ownership between `app/` and legacy `src/_root`
3. duplicated provider wrapping
4. likely inconsistent UX states across routes because of auth/layout duplication

This is a **UI architecture consistency problem**, not just styling polish.

---

## 16. Routing issue root cause + exact fix strategy

### Root cause of `/#/` style requirement

The codebase still contains a legacy **React Router browser-based SPA layer** while also running inside **Next.js App Router**.

Evidence:

- `BrowserRouter` still exists in `src/_root/ClientLayoutWrapper.tsx`
- `Navigate`, `Outlet`, and `react-router-dom` pages still exist
- Next.js route pages also exist under `app/`

That means the project historically behaved like a SPA, and hash/SPA routing patterns were likely used to avoid direct server 404s in old hosting/deployment behavior.

### Why normal routes can 404 in deployment

Because the product architecture was partially migrated:

- some links/routes are expected by the old SPA layer
- deployment/server may only know Next routes, while some old route assumptions expect client router handling
- if deployment/static rewrite rules were tuned for SPA/hash fallback, direct non-hash routes can fail depending on environment

### Exact fix strategy (explain only)

1. **Remove legacy `react-router-dom` usage completely.**
2. **Delete/retire SPA layout/page wrappers that depend on BrowserRouter/Navigate/Outlet.**
3. **Make `app/` the single routing source of truth.**
4. **Standardize all navigation on `next/link` and `next/navigation`.**
5. **Map every legacy route to a real App Router page.**
6. **Remove hash-based route dependency from deployed client navigation.**
7. **Verify Vercel routing only against Next.js route structure after cleanup.**

This is not a one-line fix. It is a **migration completion task**.

---

## 17. Search system audit

### Why search feels limited / may appear disabled in product audit

Because the backend exists only at a **basic query layer**.

What exists:

- `searchPosts()` on caption/location/tags
- `searchUsers()` on name/username
- explore UI wiring

What is missing:

- no dedicated search indexing
- no robust relevance ranking
- no server search service
- no universal search UX

So search is **not absent**, but it is **thin** and likely underwhelming in real product use.

---

## 18. Settings / account system audit

### Existing

- password reset / update
- profile update pages
- privacy settings component

### Missing

- centralized settings route/module is not evident in the Next app structure
- no evident session/device management
- no evident export/delete-account governance flow for end users
- no evident notification preferences center despite notification sound local settings in utility code

Conclusion: **account management is fragmented, not product-complete**.

---

## 19. PWA readiness audit

### Findings

- no manifest in `public/`
- no `<link rel="manifest">` evidence
- no service worker registration
- no install prompt flow
- no offline shell strategy

### Verdict

**Not PWA-ready.**

At best, the app is a responsive web app, not a progressive web app.

---

## 20. Performance & scalability audit

### What breaks first at 10k / 100k users?

1. **Feed generation**
   - too much client-side fetching/filtering/ranking.

2. **Search**
   - ilike queries will degrade without specialized indexing/search architecture.

3. **Notifications generation**
   - client-driven creation is not dependable at higher volume.

4. **Provider duplication / route duplication**
   - state complexity grows and bug surface widens.

5. **Large relational reads from browser**
   - posts with creator/likes/saves/comments counts repeatedly fetched.

### Scalability verdict

This app is **MVP-capable / low-scale usable**, but not yet architected for large social-scale traffic.

---

## 21. Security audit

### Stronger areas

- Supabase Auth is real.
- RLS exists across many tables.
- Governance server routes use service-role only on server.
- Verification/admin routes use explicit role checks.

### Main security risks

1. **Middleware is not a real auth barrier**
   - protection is mostly deferred to components.

2. **Client-heavy writes for product-critical actions**
   - correctness/security depends on RLS and client behavior.

3. **Verification documents in public-ish/general bucket pathing**
   - biggest trust/privacy risk observed.

4. **Broad public read policies**
   - social metadata exposure is intentionally permissive.

5. **Multiple auth providers / local cache complexity**
   - can lead to stale or contradictory auth UX states.

### Security verdict

**Admin/governance protection is materially better than the general app boundary design.**

---

## 22. UX/system mismatch (code vs real app)

The codebase explains why the live audit found inconsistency:

- architecture is mid-migration
- duplicate routing/navigation paradigms exist
- notifications are partly sophisticated and partly ad hoc
- search exists technically but not at polished product depth
- settings/account are fragmented
- some UI actions exist before all underlying behavior is complete

So the product feels ahead in some areas and unfinished in others because **the system itself is structurally uneven**.

---

## 23. Final product stage evaluation

### True current stage

Jigri is **beyond prototype**, but still **pre-scale MVP / early platform foundation**.

It has real systems:

- auth
- social graph
- posting/interactions
- moderation foundation
- admin foundation
- verification foundation

But it is not yet a clean, stable, scale-ready platform because of:

- routing migration incompleteness
- client-heavy feed/query architecture
- notification architecture immaturity
- settings/search/PWA incompleteness
- duplicated runtime/provider structure

### Overall assessment

**Product stage: MVP+ with important platform governance progress, but still carrying foundation debt that should be resolved before major next-phase expansion.**

---

## 24. Top 10 critical issues to fix BEFORE next phase

1. **Complete the routing migration and remove `react-router-dom` remnants.**
2. **Eliminate duplicated `QueryProvider` / `AuthProvider` wrapping across routes/layouts.**
3. **Move feed generation away from client-heavy mixed ranking/filtering toward server-driven pagination/ranking.**
4. **Replace client-generated notifications with server-side / trigger-based authoritative notification creation.**
5. **Secure verification document storage in a dedicated private bucket with controlled access.**
6. **Harden route protection so sensitive access is enforced server-side, not mostly at component level.**
7. **Unify admin/legacy role logic and finish migration away from compatibility fallbacks where possible.**
8. **Create a coherent settings/account architecture instead of scattered flows/components.**
9. **Upgrade search beyond simple ilike queries if discovery is a serious product pillar.**
10. **Remove incomplete UI affordances and dead/legacy code paths left from the SPA era.**

---

## 25. Recommended next phase

### Recommended next phase name

**Phase 5A — Foundation Consolidation & Routing Completion**

### Why this should be next

Because the most dangerous issues are not missing features anymore. They are:

- architectural split
- routing inconsistency
- state/provider duplication
- scale weakness in feed/notifications
- trust/security hardening gaps

Adding more product surface before fixing those will compound system debt.

---

## 26. Summary by requested audit categories

### What is actually implemented

- Auth, sign-in/up/session handling
- Posts, likes, comments, saves, follows
- Explore search
- Notifications UI + table + realtime subscription
- Admin stats/dashboard foundation
- Moderation reports flow
- Verification queue + role-based workflow
- Role system with moderator/admin/super_admin

### What is partially implemented

- Notifications architecture
- Search quality/depth
- Settings/account center
- Public/profile access model cleanup
- PWA readiness

### What is broken or misconfigured

- mixed Next.js + legacy SPA routing architecture
- duplicated app providers/layout wrapping
- middleware not acting as true protection layer
- incomplete delete behavior in at least one post UI path
- verification file storage model is not trust-grade

### What is missing

- finished routing migration
- scale-ready feed/search/notification architecture
- coherent settings system
- true PWA layer
- fully unified runtime architecture

### What is risky in foundation

- client-heavy feed generation
- client-generated notifications
- auth/provider duplication
- public read breadth
- schema migration drift
- storage/privacy weakness for verification evidence
