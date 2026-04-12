-- PHASE 5C - Stories System

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  is_active boolean not null default true
);

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  constraint story_views_story_id_viewer_id_key unique (story_id, viewer_id)
);

create index if not exists idx_stories_user_id on public.stories(user_id);
create index if not exists idx_stories_expires_at on public.stories(expires_at);
create index if not exists idx_story_views_story_viewer on public.story_views(story_id, viewer_id);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own"
on public.stories
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "stories_select_active_or_own" on public.stories;
create policy "stories_select_active_or_own"
on public.stories
for select
to authenticated
using ((is_active = true and expires_at > now()) or user_id = auth.uid());

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own"
on public.stories
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "story_views_insert_own" on public.story_views;
create policy "story_views_insert_own"
on public.story_views
for insert
to authenticated
with check (
  viewer_id = auth.uid()
  and exists (
    select 1
    from public.stories s
    where s.id = story_id
      and s.is_active = true
      and s.expires_at > now()
  )
);

drop policy if exists "story_views_select_own_or_story_owner" on public.story_views;
create policy "story_views_select_own_or_story_owner"
on public.story_views
for select
to authenticated
using (
  viewer_id = auth.uid()
  or exists (
    select 1
    from public.stories s
    where s.id = story_id
      and s.user_id = auth.uid()
  )
);