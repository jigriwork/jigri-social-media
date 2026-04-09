# Jigri Feature Status Matrix

Legend: **WORKING / PARTIALLY WORKING / BROKEN / PLACEHOLDER / NOT IMPLEMENTED**

| Feature | Status | Reason | Files involved | Fix status |
|---|---|---|---|---|
| signup | PARTIALLY WORKING | Flow exists and profile ensure fallback exists, but depends on Supabase auth email config + heavy client-side checks/log noise | `src/_auth/forms/SignupForm.tsx`, `src/lib/supabase/api.ts` | No core rewrite in this pass |
| signin | WORKING | Sign-in flow implemented with enhanced error handling, auth context sync | `src/_auth/forms/SigninForm.tsx`, `src/context/SupabaseAuthContext.tsx`, `src/lib/supabase/api.ts` | Validated by build/code audit |
| signout | WORKING | Signout function updates user activity and signs out | `src/lib/supabase/api.ts` (+ UI consumers) | Validated by code path |
| forgot password | PARTIALLY WORKING | Implemented but docs are inconsistent with current route flow | `app/forgot-password/page.tsx`, `src/lib/supabase/api.ts`, `PASSWORD_RESET_SETUP.md` | Needs doc cleanup |
| reset/update password | PARTIALLY WORKING | Implemented (`reset-password`, `update-password`) with robust fallback logic; complexity indicates fragility | `app/reset-password/page.tsx`, `app/update-password/page.tsx`, `src/lib/supabase/api.ts` | No redesign in this pass |
| profile creation | WORKING | Trigger + ensureUserProfile fallback both present | `supabase_bootstrap_core.sql`, `src/lib/supabase/api.ts` | Verified |
| profile edit | WORKING | Update profile UI + API update logic implemented | `src/_root/pages/UpdateProfileWrapper.tsx`, `src/lib/supabase/api.ts` | Verified |
| privacy settings | WORKING | Privacy selector updates `privacy_setting` | `src/components/shared/PrivacySettings.tsx`, `src/lib/supabase/api.ts` | Verified |
| post creation | WORKING | Create post logic + storage upload + DB insert present | `src/components/forms/PostForm*.tsx`, `src/lib/supabase/api.ts` | Verified; bucket created |
| post feed loading | WORKING | Following feed + explore/recent query hooks implemented | `src/_root/pages/Home.tsx`, `src/_root/pages/Explore.tsx`, `src/lib/supabase/api.ts` | Verified |
| image upload/storage | PARTIALLY WORKING | Uses `posts` bucket for both posts/profile images; now exists, but no separate profile bucket strategy | `src/lib/supabase/api.ts` | Bucket fixed in this pass |
| likes | WORKING | like/unlike implemented with optimistic UI behavior | `src/components/shared/PostStats.tsx`, `src/lib/react-query/queriesAndMutations.ts`, `src/lib/supabase/api.ts` | Verified |
| saves | WORKING | save/unsave implemented with duplicate handling | `src/components/shared/PostStats.tsx`, `src/lib/supabase/api.ts` | Verified |
| comments | WORKING | create/list/delete comment flows and nested replies implemented | `src/components/shared/Comments.tsx`, `src/components/forms/CommentForm.tsx`, `src/lib/supabase/api.ts` | Verified |
| comment likes | WORKING | like/unlike status handlers implemented | `src/components/shared/CommentItem.tsx`, `src/lib/supabase/api.ts` | Verified |
| follows | WORKING | follow/unfollow + follower counts + feed invalidation implemented | `src/_root/pages/ProfileWrapper.tsx`, `src/lib/react-query/queriesAndMutations.ts`, `src/lib/supabase/api.ts` | Verified |
| notifications | PARTIALLY WORKING | Notification service + bell realtime listener present; some duplicated fetching logic and UI-level complexity | `src/lib/utils/notificationService.ts`, `src/components/shared/NotificationBell.tsx` | No deep refactor in this pass |
| public profile API / share profile flow | WORKING | Public API route + shared profile route + share modal in place | `app/api/public/profile/route.ts`, `app/shared-profile/[id]/page.tsx`, `src/components/shared/ShareProfileModal.tsx` | Verified |
| admin panel | WORKING | Admin dashboard and management views are implemented | `app/admin/page.tsx`, `src/_root/pages/AdminDashboard.tsx` | Verified |
| admin actions on posts/users | PARTIALLY WORKING | Actions exist; found pagination count bug and fixed; deactivation APIs differ across implementations | `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/admin/posts/[id]/route.ts`, `src/lib/supabase/api.ts` | Safe fix applied for count; deeper harmonization pending |
| realtime features | PARTIALLY WORKING | Notifications realtime subscription implemented; broader realtime usage limited | `src/components/shared/NotificationBell.tsx`, `src/lib/utils/notificationService.ts`, `supabase_bootstrap_core.sql` | Verified notifications path only |
