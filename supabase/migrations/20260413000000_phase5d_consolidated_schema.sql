-- =============================================================
-- PHASE 5D PREP — CONSOLIDATED SCHEMA MIGRATION
-- Jigri Social Media Platform
-- Date: 2026-04-13
-- =============================================================
-- PURPOSE: Establish full authoritative schema for all domains
-- used by the application. This migration is additive (IF NOT
-- EXISTS / ADD COLUMN IF NOT EXISTS) so it is safe to run
-- against an existing live database without data loss.
-- =============================================================

-- -------------------------------------------------------
-- EXTENSION
-- -------------------------------------------------------
create extension if not exists "uuid-ossp";

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  username      text not null unique,
  email         text not null unique,
  image_url     text,
  bio           text,
  privacy_setting text not null default 'public'
                  check (privacy_setting in ('public', 'followers', 'private')),
  role          text not null default 'user'
                  check (role in ('user', 'moderator', 'admin', 'super_admin', 'superadmin')),
  is_verified   boolean not null default false,
  verification_badge_type text,
  is_active     boolean not null default true,
  username_last_changed timestamptz,
  username_change_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_public" on public.users;
create policy "users_select_public"
  on public.users for select
  using (true);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

-- -------------------------------------------------------
-- POSTS
-- -------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.users(id) on delete cascade,
  caption     text,
  image_url   text,
  location    text,
  tags        text[],
  category    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_posts_creator_id on public.posts(creator_id);
create index if not exists idx_posts_created_at on public.posts(created_at desc);

alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
  on public.posts for select
  using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = creator_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts for update
  to authenticated
  using (auth.uid() = creator_id);

drop policy if exists "posts_delete_own_or_admin" on public.posts;
create policy "posts_delete_own_or_admin"
  on public.posts for delete
  to authenticated
  using (
    auth.uid() = creator_id
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role::text in ('admin', 'super_admin', 'superadmin', 'moderator')
    )
  );

-- -------------------------------------------------------
-- COMMENTS
-- -------------------------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  content     text not null,
  is_edited   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_comments_post_id on public.comments(post_id);
create index if not exists idx_comments_user_id on public.comments(user_id);
create index if not exists idx_comments_parent_id on public.comments(parent_id);

alter table public.comments enable row level security;

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all"
  on public.comments for select
  using (true);

drop policy if exists "comments_insert_authenticated" on public.comments;
create policy "comments_insert_authenticated"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
  on public.comments for update
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "comments_delete_own_or_admin" on public.comments;
create policy "comments_delete_own_or_admin"
  on public.comments for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role::text in ('admin', 'super_admin', 'superadmin', 'moderator')
    )
  );

-- -------------------------------------------------------
-- COMMENT LIKES
-- -------------------------------------------------------
create table if not exists public.comment_likes (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint comment_likes_comment_user_key unique (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

drop policy if exists "comment_likes_select_all" on public.comment_likes;
create policy "comment_likes_select_all"
  on public.comment_likes for select using (true);

drop policy if exists "comment_likes_insert_own" on public.comment_likes;
create policy "comment_likes_insert_own"
  on public.comment_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comment_likes_delete_own" on public.comment_likes;
create policy "comment_likes_delete_own"
  on public.comment_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- -------------------------------------------------------
-- LIKES (CANONICAL POST-LIKE TABLE)
-- NOTE: Application code uses public.likes as source-of-truth.
-- -------------------------------------------------------
create table if not exists public.likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint likes_post_user_key unique (post_id, user_id)
);

create index if not exists idx_likes_post_id on public.likes(post_id);
create index if not exists idx_likes_user_id on public.likes(user_id);

alter table public.likes enable row level security;

drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all"
  on public.likes for select using (true);

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own"
  on public.likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own"
  on public.likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- -------------------------------------------------------
-- POST LIKES (LEGACY / DEPRECATED)
-- NOTE: Kept for compatibility-only in live environments.
--       Do not use for new features. Canonical table is public.likes.
-- -------------------------------------------------------
create table if not exists public.post_likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint post_likes_post_user_key unique (post_id, user_id)
);

create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_post_likes_user_id on public.post_likes(user_id);

alter table public.post_likes enable row level security;

drop policy if exists "post_likes_select_all" on public.post_likes;
create policy "post_likes_select_all"
  on public.post_likes for select using (true);

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own"
  on public.post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own"
  on public.post_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- -------------------------------------------------------
-- SAVES
-- -------------------------------------------------------
create table if not exists public.saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  post_id     uuid not null references public.posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint saves_user_post_key unique (user_id, post_id)
);

create index if not exists idx_saves_user_id on public.saves(user_id);

alter table public.saves enable row level security;

drop policy if exists "saves_select_own" on public.saves;
create policy "saves_select_own"
  on public.saves for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saves_insert_own" on public.saves;
create policy "saves_insert_own"
  on public.saves for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saves_delete_own" on public.saves;
create policy "saves_delete_own"
  on public.saves for delete
  to authenticated
  using (auth.uid() = user_id);

-- -------------------------------------------------------
-- FOLLOWS
-- -------------------------------------------------------
create table if not exists public.follows (
  id            uuid primary key default gen_random_uuid(),
  follower_id   uuid not null references public.users(id) on delete cascade,
  following_id  uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint follows_follower_following_key unique (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists idx_follows_follower_id on public.follows(follower_id);
create index if not exists idx_follows_following_id on public.follows(following_id);

alter table public.follows enable row level security;

drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all"
  on public.follows for select using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- -------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------
create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  from_user_id      uuid references public.users(id) on delete set null,
  from_user_name    text,
  from_user_avatar  text,
  type              text not null
                      check (type in ('like', 'comment', 'follow', 'mention', 'new_post', 'system', 'message')),
  title             text,
  message           text,
  avatar            text,
  action_url        text,
  read              boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_read on public.notifications(read);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id or is_current_user_admin());

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
  on public.notifications for insert
  to authenticated
  with check (
    auth.uid() is not null
    and (from_user_id is null or from_user_id = auth.uid())
  );

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id or is_current_user_admin())
  with check (auth.uid() = user_id or is_current_user_admin());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id or is_current_user_admin());

-- -------------------------------------------------------
-- CONVERSATIONS
-- -------------------------------------------------------
create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  participant_one     uuid not null references public.users(id) on delete cascade,
  participant_two     uuid not null references public.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint conversations_participants_key unique (participant_one, participant_two),
  constraint conversations_no_self_chat check (participant_one <> participant_two)
);

create index if not exists idx_conversations_participant_one on public.conversations(participant_one);
create index if not exists idx_conversations_participant_two on public.conversations(participant_two);

alter table public.conversations enable row level security;

drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants"
  on public.conversations for select
  to authenticated
  using (auth.uid() = participant_one or auth.uid() = participant_two);

drop policy if exists "conversations_insert_authenticated" on public.conversations;
create policy "conversations_insert_authenticated"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = participant_one or auth.uid() = participant_two);

-- -------------------------------------------------------
-- MESSAGES
-- -------------------------------------------------------
create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  sender_id         uuid not null references public.users(id) on delete cascade,
  content           text not null,
  read              boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
    )
  );

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
    )
  );

-- -------------------------------------------------------
-- STORIES (already created in phase5c migration)
-- Additional columns / indexes that may be missing
-- -------------------------------------------------------
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  media_url   text not null,
  media_type  text not null check (media_type in ('image', 'video')),
  caption     text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  is_active   boolean not null default true
);

create table if not exists public.story_views (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid not null references public.stories(id) on delete cascade,
  viewer_id   uuid not null references public.users(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  constraint story_views_story_id_viewer_id_key unique (story_id, viewer_id)
);

create index if not exists idx_stories_user_id on public.stories(user_id);
create index if not exists idx_stories_expires_at on public.stories(expires_at);
create index if not exists idx_story_views_story_viewer on public.story_views(story_id, viewer_id);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Stories RLS (idempotent drop-create)
drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own"
  on public.stories for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "stories_select_active_or_own" on public.stories;
create policy "stories_select_active_or_own"
  on public.stories for select
  to authenticated
  using ((is_active = true and expires_at > now()) or user_id = auth.uid());

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own"
  on public.stories for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "story_views_insert_own" on public.story_views;
create policy "story_views_insert_own"
  on public.story_views for insert
  to authenticated
  with check (
    viewer_id = auth.uid()
    and exists (
      select 1 from public.stories s
      where s.id = story_id
        and s.is_active = true
        and s.expires_at > now()
    )
  );

drop policy if exists "story_views_select_own_or_story_owner" on public.story_views;
create policy "story_views_select_own_or_story_owner"
  on public.story_views for select
  to authenticated
  using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- REPORTS
-- -------------------------------------------------------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.users(id) on delete set null,
  entity_type   text not null,
  entity_id     text not null,
  reason_code   text not null,
  description   text,
  status        text not null default 'open'
                  check (status in ('open', 'triaged', 'in_review', 'resolved', 'dismissed', 'escalated')),
  priority      text not null default 'normal'
                  check (priority in ('low', 'normal', 'high', 'critical')),
  assigned_to_user_id uuid references public.users(id) on delete set null,
  resolved_at   timestamptz,
  resolution_code text,
  resolution_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_reports_reporter_user_id on public.reports(reporter_user_id);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_assigned_to on public.reports(assigned_to_user_id);
create index if not exists idx_reports_created_at on public.reports(created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_authenticated" on public.reports;
create policy "reports_insert_authenticated"
  on public.reports for insert
  to authenticated
  with check (auth.uid() is not null and reporter_user_id = auth.uid());

drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_user_id or is_current_user_admin());

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports for update
  to authenticated
  using (is_current_user_admin())
  with check (is_current_user_admin());

-- -------------------------------------------------------
-- REPORT ACTIONS
-- -------------------------------------------------------
create table if not exists public.report_actions (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role  app_role,
  action_type text not null,
  reason      text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_report_actions_report_id on public.report_actions(report_id);

alter table public.report_actions enable row level security;

drop policy if exists "report_actions_admin" on public.report_actions;
create policy "report_actions_admin"
  on public.report_actions for select
  to authenticated
  using (is_current_user_admin());

drop policy if exists "report_actions_no_client_insert" on public.report_actions;
create policy "report_actions_no_client_insert"
  on public.report_actions for insert
  to authenticated
  with check (false);

-- -------------------------------------------------------
-- GOVERNANCE AUDIT LOG
-- -------------------------------------------------------
create table if not exists public.governance_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role  app_role,
  action_type text not null,
  target_type text,
  target_id   uuid,
  reason      text,
  metadata    jsonb,
  before_snapshot jsonb,
  after_snapshot  jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_governance_audit_log_created_at on public.governance_audit_log(created_at desc);
create index if not exists idx_governance_audit_log_actor on public.governance_audit_log(actor_user_id);
create index if not exists idx_governance_audit_log_target on public.governance_audit_log(target_type, target_id);

alter table public.governance_audit_log enable row level security;

drop policy if exists "governance_audit_admin" on public.governance_audit_log;
create policy "governance_audit_admin"
  on public.governance_audit_log for select
  to authenticated
  using (is_current_user_admin());

drop policy if exists "governance_audit_no_client_insert" on public.governance_audit_log;
create policy "governance_audit_no_client_insert"
  on public.governance_audit_log for insert
  to authenticated
  with check (false);

-- -------------------------------------------------------
-- VERIFICATION APPLICATIONS
-- -------------------------------------------------------
create table if not exists public.verification_applications (
  id              uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  status          text not null default 'submitted'
                    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revoked', 'needs_resubmission', 'withdrawn')),
  application_type text not null check (application_type in ('person', 'creator', 'organization')),
  requested_badge_type text not null check (requested_badge_type in ('verified', 'official')),
  evidence_payload jsonb not null default '{}'::jsonb,
  review_notes    text,
  rejection_reason_code text,
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  reviewed_at     timestamptz,
  final_decision_by_user_id uuid references public.users(id) on delete set null,
  final_decision_at timestamptz,
  resubmission_count integer not null default 0,
  cooldown_until  timestamptz,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_verification_applications_applicant on public.verification_applications(applicant_user_id);
create index if not exists idx_verification_applications_status on public.verification_applications(status);
create index if not exists idx_verification_applications_created_at on public.verification_applications(created_at desc);

alter table public.verification_applications enable row level security;

drop policy if exists "verification_apps_select_own_or_admin" on public.verification_applications;
create policy "verification_apps_select_own_or_admin"
  on public.verification_applications for select
  to authenticated
  using (auth.uid() = applicant_user_id or is_current_user_admin());

drop policy if exists "verification_apps_insert_own" on public.verification_applications;
create policy "verification_apps_insert_own"
  on public.verification_applications for insert
  to authenticated
  with check (auth.uid() = applicant_user_id);

drop policy if exists "verification_apps_update_own_or_admin" on public.verification_applications;
create policy "verification_apps_update_own_or_admin"
  on public.verification_applications for update
  to authenticated
  using (is_current_user_admin())
  with check (is_current_user_admin());

drop policy if exists "verification_apps_no_direct_user_update" on public.verification_applications;
create policy "verification_apps_no_direct_user_update"
  on public.verification_applications for update
  to authenticated
  using (false)
  with check (false);

-- -------------------------------------------------------
-- VERIFICATION APPLICATION EVENTS
-- -------------------------------------------------------
create table if not exists public.verification_application_events (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.verification_applications(id) on delete cascade,
  actor_user_id   uuid references public.users(id) on delete set null,
  actor_role      app_role,
  event_type      text not null,
  from_status     text,
  to_status       text,
  reason          text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_verification_events_application on public.verification_application_events(application_id);
create index if not exists idx_verification_events_created_at on public.verification_application_events(created_at desc);

alter table public.verification_application_events enable row level security;

drop policy if exists "verification_events_admin" on public.verification_application_events;
create policy "verification_events_admin"
  on public.verification_application_events for select
  to authenticated
  using (
    is_current_user_admin()
    or exists (
      select 1 from public.verification_applications va
      where va.id = verification_application_events.application_id
        and va.applicant_user_id = auth.uid()
    )
  );

drop policy if exists "verification_events_no_client_insert" on public.verification_application_events;
create policy "verification_events_no_client_insert"
  on public.verification_application_events for insert
  to authenticated
  with check (false);

-- -------------------------------------------------------
-- STORAGE BUCKETS / POLICIES (idempotent)
-- -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stories',
  'stories',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']::text[]
)
on conflict (id) do nothing;

drop policy if exists "stories_select_auth" on storage.objects;
create policy "stories_select_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'stories');

drop policy if exists "stories_insert_auth" on storage.objects;
create policy "stories_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stories' and auth.uid() is not null);

drop policy if exists "stories_update_auth" on storage.objects;
create policy "stories_update_auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'stories' and auth.uid() is not null)
  with check (bucket_id = 'stories' and auth.uid() is not null);

drop policy if exists "stories_delete_auth" on storage.objects;
create policy "stories_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'stories' and auth.uid() is not null);

-- Canonical stories storage path: <user_id>/<story_id>/media.<ext>
-- Canonical persisted media_url format in public.stories: stories://<path>
-- Legacy public URLs under posts bucket are intentionally retained for compatibility.
-- -------------------------------------------------------

-- End of consolidated schema migration
