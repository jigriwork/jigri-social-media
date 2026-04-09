# Jigri Feature Matrix (Current Implementation State)

Legend:
- **Fully implemented** = works end-to-end in current app flow
- **Partially implemented** = available but with architectural/UX/security limitations
- **Minimal/MVP** = basic version exists
- **Hidden/Internal** = implemented mostly for internal/admin/system use
- **Legacy/Risky** = conflicting/duplicate/fragile implementation

---

## Core Product Features

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Auth | Sign up | Partially implemented | `SignupForm` + `signUpUser`; good UX; duplicate checks are app-level not hard transactional authority |
| Auth | Sign in | Fully implemented | `SigninForm`, enhanced error handling, auth context integration |
| Auth | Sign out | Fully implemented | Topbar/Sidebar + `signOutUser` status updates |
| Auth | Forgot password | Fully implemented | `/forgot-password` + `sendPasswordResetEmail` |
| Auth | Password reset/update | Partially implemented | Both OTP and magic-link session paths exist (functional but duplicated complexity) |
| Auth | Auth callback | Fully implemented | `/auth/callback` handles code exchange and recovery redirect |
| Auth | Guest prompt on restricted action | Fully implemented | `AuthPromptModal` used in likes/saves/comments/follows |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Profiles | Profile view | Fully implemented | `/profile/[id]`, `/shared-profile/[id]` |
| Profiles | Edit profile | Fully implemented | `/update-profile/[id]`, image + bio + name |
| Profiles | Share profile | Fully implemented | share modal + copy fallback + web share |
| Profiles | Public/shared profile | Fully implemented | dedicated route + API fallback |
| Profiles | Privacy setting | Partially implemented | UI exists (`public/private/followers_only`), enforcement applied inconsistently across query surfaces |
| Profiles | Verified badge/trust badge | Not implemented | no verified field/UI/logic found |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Posting | Create post | Fully implemented | caption/media/location/tags/category |
| Posting | Edit post | Fully implemented | update form + update mutation |
| Posting | Delete own post | Fully implemented | post card + details deletion path |
| Posting | Post category | Fully implemented | `general/announcement/question` |
| Posting | Media upload | Partially implemented | works via Supabase storage but strict size + bucket strategy compromises |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Engagement | Likes | Fully implemented | post like/unlike + count + notification |
| Engagement | Saves | Fully implemented | save/unsave + saved page |
| Engagement | Comments | Fully implemented | create/list/replies/delete/edit |
| Engagement | Comment likes | Fully implemented | like/unlike comment |
| Engagement | Shares | Minimal/MVP | share button and modal/copy, no analytics loop |
| Engagement | Follow/unfollow | Fully implemented | follow system + counts + notification |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Feed/Discovery | Home following feed | Fully implemented | followed + own + public mix with scoring |
| Feed/Discovery | Suggested users | Partially implemented | heuristic-based, no advanced graph ranking |
| Feed/Discovery | Explore infinite grid | Fully implemented | paginated/infinite query flow |
| Feed/Discovery | Search posts | Fully implemented | debounced search |
| Feed/Discovery | Search users | Fully implemented | debounced directory search |
| Feed/Discovery | Onboarding nudges | Fully implemented | 3-step home checklist |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Notifications | In-app bell | Fully implemented | unread badge + dropdown |
| Notifications | Realtime updates | Fully implemented | Supabase realtime subscription on notifications table |
| Notifications | Notification creation triggers | Fully implemented | like/comment/follow/new post |
| Notifications | Mark as read | Fully implemented | per-open + bulk update behavior |
| Notifications | Full notification inbox page | Minimal/MVP | no dedicated page, dropdown-only UX |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Admin | Admin dashboard stats | Fully implemented | users/posts/activity/likes/comments/new users |
| Admin | Admin management (grant/revoke admin) | Partially implemented | works but role model relies on hardcoded super-admin emails |
| Admin | User listing/search/pagination | Fully implemented | admin content management panel |
| Admin | User deactivation/reactivation | Fully implemented | toggle status with restrictions |
| Admin | Post listing/search/pagination | Fully implemented | admin content management panel |
| Admin | Delete any post | Fully implemented | admin delete APIs + UI action |
| Admin | Moderation queue/reports/appeals | Not implemented | absent |
| Admin | Audit logs for admin actions | Not implemented | absent |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Privacy/Safety | Privacy levels | Partially implemented | configured but not uniformly enforced |
| Privacy/Safety | Account deactivation lockout | Fully implemented | login blocks deactivated users |
| Privacy/Safety | Block/mute/report user | Not implemented | absent |
| Privacy/Safety | Content reporting tools | Not implemented | absent |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Technical UX | Responsive layout | Fully implemented | topbar/left/bottom adaptive structure |
| Technical UX | Loading states/skeletons | Partially implemented | present in many views, inconsistent in some routes |
| Technical UX | Error states | Partially implemented | present but uneven consistency |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Realtime | Notification realtime | Fully implemented | Supabase channel subscription |
| Realtime | Presence indicators | Partially implemented | `is_active/last_active` heartbeats, no dedicated robust presence infra |
| Realtime | Live feed/comments updates | Minimal/MVP | mostly query invalidation/polling-style refetch, not full realtime streams |

| Domain | Feature | Status | Evidence / Notes |
|---|---|---|---|
| PWA | Manifest | Not implemented | no `manifest.json` |
| PWA | Service worker | Not implemented | no SW registration / script |
| PWA | Install prompt | Not implemented | no beforeinstallprompt handling |
| PWA | Offline mode | Minimal/MVP | React Query offlineFirst/cache helps transiently, but no true offline app shell |

---

## Hidden/Internal/Legacy-Risk Inventory

- **Hidden/Internal**
  - `/api/public/profile` uses service-role path fallback for public profile fetch.
  - Admin APIs exist separately from client API methods.

- **Legacy/Risky**
  - `src/_root/pages/PostDetails.tsx` still imports `react-router-dom` (legacy in Next app).
  - Multiple profile page variants (`Profile.tsx`, `ProfileWrapper.tsx`) and post forms (`PostForm.tsx`, `PostFormNextJS.tsx`).
  - Highly verbose debug logs in auth/api paths.
