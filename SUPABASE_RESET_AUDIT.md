# SUPABASE RESET AUDIT

## Project and verification scope
- Required project URL used: `https://wztqxpcfprghqmqvconk.supabase.co`
- Required project ref used: `wztqxpcfprghqmqvconk`
- Verification performed against live REST and Storage APIs using `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`).

## Final architecture (single integration approach)
- **Primary pattern:** Next.js + `@supabase/ssr` helper split.
  - Browser client: `src/lib/supabase/client.ts`
  - Server client: `src/lib/supabase/server.ts`
- **Privileged server access (service role):** `src/lib/supabase/admin.ts` using `@supabase/supabase-js` (server-side only).
- **Route migration to single pattern:** `app/api/public/profile/route.ts` now uses `createAdminClient()` instead of its own ad-hoc `createClient(...)` setup.
- **Removed conflicting/duplicate setup:** legacy reset-password backup/fixed files and unused Supabase middleware helper were removed.

## Environment variables used (standardized)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (non-Supabase app URL config)

Removed from templates/local env as duplicate/unused for this architecture:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SECRET_KEY`

## Live truth verification results (no assumptions)

### Project ref
- **Verified:** `wztqxpcfprghqmqvconk`

### Schema status (real)
Live checks for required runtime tables returned **404 (missing in schema cache)**:
- `users`
- `posts`
- `follows`
- `likes`
- `saves`
- `comments`
- `comment_likes`
- `notifications`

Conclusion: **Schema does not currently exist** for required app tables.

### Storage status (real)
Live bucket listing returned 200 and includes:
- `posts`

Conclusion: **Storage exists** (required `posts` bucket present).

## Files changed/removed for reset

### Added
- `src/lib/supabase/admin.ts`
- `supabase_jigri_bootstrap.sql`
- `SUPABASE_RESET_AUDIT.md`

### Updated
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `app/api/public/profile/route.ts`
- `.env.example`
- `.env.local.example`
- `.env.local`
- `package.json`

### Removed
- `app/reset-password/page-fixed.tsx`
- `app/reset-password/page-backup.tsx`
- `src/lib/supabase/middleware.ts`

## Schema bootstrap file generated
- Generated: `supabase_jigri_bootstrap.sql`
- Includes all code-required tables, columns, defaults, FKs, indexes, triggers, RLS policies, realtime publication for notifications, and storage bucket/policies for `posts`.

## Storage requirement summary
- Required by codebase: `posts`
- Live status: exists.
