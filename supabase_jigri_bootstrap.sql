-- Jigri full Supabase bootstrap for project ref: wztqxpcfprghqmqvconk
-- Generated because live schema verification returned 404 for all required tables.
-- This script creates all tables used by the current codebase, indexes, triggers, RLS,
-- helper functions, and storage bucket policies.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  image_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_deactivated BOOLEAN NOT NULL DEFAULT false,
  last_active TIMESTAMPTZ,
  privacy_setting TEXT NOT NULL DEFAULT 'public' CHECK (privacy_setting IN ('public', 'private', 'followers_only'))
);

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  caption TEXT NOT NULL,
  image_url TEXT,
  location TEXT,
  tags TEXT[],
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'announcement', 'question')),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  UNIQUE (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  from_user_name TEXT,
  from_user_avatar TEXT,
  type TEXT NOT NULL CHECK (type IN ('new_post', 'like', 'comment', 'follow')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  avatar TEXT,
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================================
-- FUNCTIONS / TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
CREATE TRIGGER trg_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, username, image_url, bio, is_active, is_deactivated, last_active, privacy_setting)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    NULL,
    NULL,
    FALSE,
    FALSE,
    NULL,
    'public'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    username = COALESCE(EXCLUDED.username, users.username),
    privacy_setting = COALESCE(EXCLUDED.privacy_setting, users.privacy_setting);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = target_user_id
      AND is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT public.is_admin_user(auth.uid());
$$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_deactivated ON public.users(is_deactivated);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active);
CREATE INDEX IF NOT EXISTS idx_users_privacy_setting ON public.users(privacy_setting);

CREATE INDEX IF NOT EXISTS idx_posts_creator_id ON public.posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);

CREATE INDEX IF NOT EXISTS idx_saves_user_id ON public.saves(user_id);
CREATE INDEX IF NOT EXISTS idx_saves_post_id ON public.saves(post_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON public.comment_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Realtime publication for notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- USERS
DROP POLICY IF EXISTS "Public can read users" ON public.users;
CREATE POLICY "Public can read users" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert self profile" ON public.users;
CREATE POLICY "Users can insert self profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile or admin" ON public.users;
CREATE POLICY "Users can update own profile or admin" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = id OR public.is_current_user_admin());

-- POSTS
DROP POLICY IF EXISTS "Public can read posts" ON public.posts;
CREATE POLICY "Public can read posts" ON public.posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can create own posts" ON public.posts;
CREATE POLICY "Authenticated can create own posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can update own posts or admin" ON public.posts;
CREATE POLICY "Users can update own posts or admin" ON public.posts
  FOR UPDATE USING (auth.uid() = creator_id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = creator_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can delete own posts or admin" ON public.posts;
CREATE POLICY "Users can delete own posts or admin" ON public.posts
  FOR DELETE USING (auth.uid() = creator_id OR public.is_current_user_admin());

-- LIKES
DROP POLICY IF EXISTS "Public can read likes" ON public.likes;
CREATE POLICY "Public can read likes" ON public.likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own likes" ON public.likes;
CREATE POLICY "Users can insert own likes" ON public.likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;
CREATE POLICY "Users can delete own likes" ON public.likes
  FOR DELETE USING (auth.uid() = user_id OR public.is_current_user_admin());

-- SAVES
DROP POLICY IF EXISTS "Public can read saves" ON public.saves;
CREATE POLICY "Public can read saves" ON public.saves
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own saves" ON public.saves;
CREATE POLICY "Users can insert own saves" ON public.saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saves" ON public.saves;
CREATE POLICY "Users can delete own saves" ON public.saves
  FOR DELETE USING (auth.uid() = user_id OR public.is_current_user_admin());

-- FOLLOWS
DROP POLICY IF EXISTS "Public can read follows" ON public.follows;
CREATE POLICY "Public can read follows" ON public.follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own follows" ON public.follows;
CREATE POLICY "Users can insert own follows" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can delete own follows" ON public.follows;
CREATE POLICY "Users can delete own follows" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id OR public.is_current_user_admin());

-- COMMENTS
DROP POLICY IF EXISTS "Public can read comments" ON public.comments;
CREATE POLICY "Public can read comments" ON public.comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own comments" ON public.comments;
CREATE POLICY "Users can create own comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments or admin" ON public.comments;
CREATE POLICY "Users can update own comments or admin" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can delete own comments or admin" ON public.comments;
CREATE POLICY "Users can delete own comments or admin" ON public.comments
  FOR DELETE USING (auth.uid() = user_id OR public.is_current_user_admin());

-- COMMENT LIKES
DROP POLICY IF EXISTS "Public can read comment likes" ON public.comment_likes;
CREATE POLICY "Public can read comment likes" ON public.comment_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own comment likes" ON public.comment_likes;
CREATE POLICY "Users can insert own comment likes" ON public.comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comment likes" ON public.comment_likes;
CREATE POLICY "Users can delete own comment likes" ON public.comment_likes
  FOR DELETE USING (auth.uid() = user_id OR public.is_current_user_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can create notifications as actor" ON public.notifications;
CREATE POLICY "Users can create notifications as actor" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (from_user_id IS NULL OR from_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can mark own notifications" ON public.notifications;
CREATE POLICY "Users can mark own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications" ON public.notifications
  FOR DELETE USING (public.is_current_user_admin());

-- ============================================================================
-- PRIVILEGES
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.users, public.posts, public.likes, public.saves, public.follows, public.comments, public.comment_likes TO anon;
GRANT ALL ON public.users, public.posts, public.likes, public.saves, public.follows, public.comments, public.comment_likes, public.notifications TO authenticated;

-- ============================================================================
-- STORAGE BUCKET + POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read post images" ON storage.objects;
CREATE POLICY "Public can read post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Authenticated can upload post images" ON storage.objects;
CREATE POLICY "Authenticated can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'posts' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can update post images" ON storage.objects;
CREATE POLICY "Authenticated can update post images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'posts' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'posts' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can delete post images" ON storage.objects;
CREATE POLICY "Authenticated can delete post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'posts' AND auth.uid() IS NOT NULL);

COMMIT;
