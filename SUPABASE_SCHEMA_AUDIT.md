# Supabase Schema Audit — Jigri

## 1) Current env variables actually used by running code

### Actively used
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server fallback in public profile API)
- `NEXT_PUBLIC_APP_URL` (app URL config utility)

### Present in `.env.local` but unused in runtime code
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SECRET_KEY`

---

## 2) Current connection status

- **Supabase connected**: Yes
- **Project URL in use**: `https://wztqxpcfprghqmqvconk.supabase.co`
- **Anon client connectivity**: Verified (table head selects succeed)
- **Service role connectivity**: Verified (table and storage introspection succeed)
- **Supabase CLI availability**: Not available in this environment (`supabase` command not found)

---

## 3) Required schema from current codebase

### Required tables
- `users`
- `posts`
- `likes`
- `saves`
- `follows`
- `comments`
- `comment_likes`
- `notifications`
- `admin_audit_log` (from admin SQL policies)

### Required notable columns
- `users`: `is_admin`, `is_active`, `is_deactivated`, `last_active`, `privacy_setting`
- `posts`: `category`, `tags`, `creator_id`
- `comments`: `parent_id`, `is_edited`
- `notifications`: `from_user_id`, `from_user_name`, `from_user_avatar`, `type`, `read`, `action_url`

### Required storage
- Bucket: `posts`

### Required realtime
- `notifications` table in realtime publication (as defined in bootstrap SQL)

---

## 4) Current schema found in connected project

Verified present:
- Tables: `users`, `posts`, `likes`, `saves`, `follows`, `comments`, `comment_likes`, `notifications`, `admin_audit_log`
- Checked required columns for core social tables and notifications: present
- Storage buckets: `posts` (present after audit fix)

---

## 5) Missing schema / inconsistencies found

### Missing at runtime: none critical after this pass

### Inconsistency found and fixed
- Admin stats logic used `last_sign_in_at` (not in schema expectations). Updated to `is_active + last_active` query basis in `src/lib/supabase/api.ts`.

### Documentation-level drift
- Password reset docs mention `/verify-otp` route while current implementation uses `/forgot-password`, `/reset-password`, `/update-password`.

---

## 6) SQL files quality assessment

- `supabase_bootstrap_core.sql`: **Comprehensive baseline** (tables, triggers, indexes, notifications realtime publication).
- `add_user_status_columns.sql`, `add_privacy_and_categories.sql`, `fix_signup_trigger.sql`, `admin_policies.sql`, `enable_public_profile_access.sql`: **incremental overlays**.
- `add_admin_column.sql`, `fix_admin_rls_policies.sql`: effectively placeholders/empty.
- `reset_user_activity.sql`, `test_activity_states.sql`: test/ops helper scripts.

Conclusion: SQL set is **mostly incremental + one core bootstrap**; not a strict migration chain, but workable if executed in controlled order.

---

## 7) SQL execution status

- Direct SQL migration execution through CLI: **Not possible** (CLI missing).
- Live schema verification through Supabase JS clients: **Completed**.
- Storage bucket creation: **Executed successfully** (`posts` created).

---

## 8) Storage bucket status

- `posts`: **Present** (created in this audit pass).

---

## 9) Final recommended SQL order

If you need to reprovision another Supabase project, run in this order:

1. `supabase_bootstrap_core.sql`
2. `add_user_status_columns.sql`
3. `add_privacy_and_categories.sql`
4. `fix_signup_trigger.sql`
5. `admin_policies.sql`
6. `enable_public_profile_access.sql` (only if public unauth/profile access is desired)
7. `reset_user_activity.sql` (optional utility)
8. `test_activity_states.sql` (optional test utility)
