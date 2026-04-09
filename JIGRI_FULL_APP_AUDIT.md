# Jigri Full App Audit (Deep Walkthrough)

Date: 2026-04-09  
Scope: Codebase walkthrough + architecture/product audit (no major feature implementation)

---

## 1) Product Walkthrough Audit

## A. First-time visitor (unauthenticated)

### What they can access
- `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/auth-code-error`
- Public content routes are effectively reachable because middleware allows all and auth is mostly component-level:
  - `/posts/[id]`
  - `/profile/[id]`
  - `/shared-profile/[id]`

### What they see
- Auth pages are polished split-screen UI with logo/branding.
- Public post page (`/posts/[id]`) renders content using `useGetPublicPostById` if no logged-in user.
- Shared profile page has dedicated unauthenticated mode via `SharedProfileWrapper` + public hooks.
- Interaction attempts (like/save/comment/follow) trigger auth prompt modal (`AuthPromptModal`).

### Works well
- Good guest-to-auth conversion nudges (modal prompts).
- Public profile/post deep links supported.
- Password reset includes multiple fallback paths.

### Weak/incomplete
- `middleware.ts` does not enforce protected routes (explicitly returns `next()` for everything).
- Public profile data fallback may return synthetic profile objects when queries fail (can hide real issues).
- Mixed use of public route `/profile/[id]` and `/shared-profile/[id]` creates conceptual overlap.

### Maturity verdict
- **MVP+ / Beta behavior**. Good shareability, but route protection model is intentionally permissive and fragile.

---

## B. Signed-up normal user

## Signup flow
- `SignupForm` validates + does live availability checks (email/username).
- Calls `signUpUser` -> creates Supabase auth user, then tries to ensure profile row exists.
- Redirects to sign-in after success.

**Good:** real-time availability, detailed errors.  
**Weak:** heavy client-side logging and brittle duplicate checks (no global transactional guarantee).  
**Readiness:** **Partial-to-strong MVP**.

## Login flow
- `SigninForm` handles custom error mapping:
  - Email unverified
  - Invalid creds
  - Deactivated account
- On success, calls `checkAuthUser` from context and redirects to `/`.

**Good:** practical error UX.  
**Weak:** auth context is complex with localStorage cache + recovery timeouts; possible race conditions.  
**Readiness:** **Beta-ready, but complex internals**.

## Password reset/update
- `forgot-password` -> `sendPasswordResetEmail`
- Callback route handles `type=recovery` and redirects to `/update-password`
- Two reset paths exist:
  - OTP-style reset page (`/reset-password`) using `signInWithOtp` + `verifyOtp`
  - Magic-link authenticated update page (`/update-password`) using session + `updateUser`

**Good:** resilient fallback strategy.  
**Weak:** duplicated recovery pathways + over-complicated logic; likely maintenance risk.  
**Readiness:** **Functional but complex**.

## Onboarding behavior after signup
- Home page contains onboarding checklist:
  1. Upload profile photo
  2. Follow 3 users
  3. Create first post

**Good:** explicit activation nudges.  
**Weak:** simple heuristic only; no persisted onboarding state model.  
**Readiness:** **Strong MVP polish**.

---

## C. Active social user walkthrough

## Home/feed (`/`)
- Uses following feed (`useGetFollowingFeed`) + suggested users.
- Feed mixes followed + own + public fallback posts with scoring.
- Empty state links to Explore/People/Create.

**Good:** thoughtful feed fallback and onboarding.  
**Weak:** feed logic is heavy in client API layer; no server-side precompute.  
**Readiness:** **Beta-quality UX, moderate scalability risk**.

## Explore (`/explore`)
- Infinite scroll + search.
- “Popular Today” label + refresh button.

**Good:** usable discovery UX.  
**Weak:** no real filtering backend despite filter icon; popularity is mostly recent list behavior.  
**Readiness:** **Partial**.

## People (`/all-users`)
- User directory with debounced search.
- Removes current user from results.

**Good:** clean search UX.  
**Weak:** no advanced ranking or mutual/follow suggestions on this page.

## Create post (`/create-post`)
- Post form supports caption, image upload, location, tags, category.
- Category options: general / announcement / question.

**Good:** full social post create flow.  
**Weak:** file limits strict (2MB), storage bucket reuse for profile pics/posts.

## Post details (`/posts/[id]`)
- Displays post, creator, stats, comments.
- Edit/delete for owner.
- Public mode supported.

**Good:** complete detail screen with comments.  
**Weak:** deletion handler in route page has placeholder comment and back navigation fallback; duplicate post detail implementations exist (`PostDetails.tsx` legacy).  
**Readiness:** **Mostly complete, some legacy confusion**.

## Interactions
- Likes, saves, comments, comment likes, replies, share.
- Auth prompts for guests.
- Notification creation on like/comment/follow/new post.

**Good:** broad interaction surface already implemented.  
**Weak:** comment UI logic is very large (`QuickComment.tsx`), high complexity.

## Profile (`/profile/[id]`)
- Own profile: edit, settings/privacy, share, posts/liked tabs.
- Other profile: follow/unfollow + share.
- Privacy indicator and settings component present.

**Good:** profile is feature-rich.  
**Weak:** duplicate profile page variants (`Profile.tsx` and `ProfileWrapper.tsx`) and inconsistent code paths.

## Saved/Liked
- Saved page `/saved` complete.
- Liked content via tab in profile (`LikedPosts`).

**Readiness:** **implemented**.

## Notifications
- Bell with realtime subscription to `notifications` table.
- Grouping, unread badge, mark-read behavior.

**Good:** useful and modern UX.  
**Weak:** no explicit notification center page/history controls beyond dropdown.

---

## D. Admin / super admin candidate walkthrough

## Admin dashboard (`/admin`)
- Guarded by `useCheckAdminAccess` in UI.
- Stats cards: users/posts/active today/likes/comments/new users.
- Derived metrics panel.
- Admin management section + user/content management section.

## Admin actions currently available
- Add admin by email (must already exist user).
- Remove admin (blocked for self + initial admin emails).
- View paginated users.
- Deactivate/activate non-admin users.
- View paginated posts.
- Delete any post.

## Major caveats
- No true dedicated role table or role hierarchy.
- “Super admin” is inferred from hardcoded email list (`owner@jigri.app`, `admin@jigri.app`).
- No audit trail, no reason codes, no moderation queues.

### Maturity verdict
- **Admin is functional but still operational-MVP** (not enterprise-safe).

---

## 2) Route/Screen Inventory (implemented surfaces)

- `/` Home feed
- `/explore`
- `/all-users`
- `/create-post`
- `/saved`
- `/admin`
- `/posts/[id]`
- `/profile/[id]`
- `/shared-profile/[id]`
- `/update-post/[id]`
- `/update-profile/[id]`
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/reset-password`
- `/update-password`
- `/auth/callback`
- `/auth/auth-code-error`

API routes:
- `/api/admin/stats`
- `/api/admin/users`, `/api/admin/users/[id]`
- `/api/admin/posts`, `/api/admin/posts/[id]`
- `/api/public/profile`

---

## 3) Production-readiness snapshot by area

- Auth flows: **Mostly complete**
- Core social loop (post/like/save/comment/follow): **Complete MVP+**
- Notification system: **Strong MVP/Beta**
- Profile/privacy controls: **Partial-to-strong**
- Admin controls: **Partial**
- Security/access model: **Needs hardening**
- PWA readiness: **Not ready**

---

## 4) Key strengths (product)

- Full social interaction stack exists (not just feed + likes).
- Public sharing routes exist for growth loops.
- Onboarding nudges and quality empty states.
- Admin panel already integrated with actionable controls.
- Real-time notifications connected.

## 5) Key weaknesses (product)

- Duplicate/legacy implementations increase behavior drift risk.
- Role model is binary + hardcoded super-admin concept.
- Middleware auth policy is intentionally non-protective.
- Overly large client files for critical logic.
- No first-class moderation workflows.
