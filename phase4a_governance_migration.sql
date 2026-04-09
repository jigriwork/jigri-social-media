-- Phase 4A governance migration (safe, compatibility-first)
-- Apply manually in Supabase SQL editor.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role public.app_role;

UPDATE public.users
SET role = CASE
  WHEN is_admin IS TRUE THEN 'admin'::public.app_role
  ELSE 'user'::public.app_role
END
WHERE role IS NULL;

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'user'::public.app_role;

UPDATE public.users
SET role = 'super_admin'::public.app_role,
    is_admin = TRUE
WHERE LOWER(email) = 'admin@jigri.in';

CREATE OR REPLACE FUNCTION public.sync_user_role_admin_compat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS NULL THEN
    NEW.role := CASE WHEN COALESCE(NEW.is_admin, false) THEN 'admin'::public.app_role ELSE 'user'::public.app_role END;
  END IF;

  NEW.is_admin := (NEW.role IN ('admin'::public.app_role, 'super_admin'::public.app_role));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_role_admin_compat ON public.users;
CREATE TRIGGER trg_sync_user_role_admin_compat
BEFORE INSERT OR UPDATE OF role, is_admin ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_admin_compat();

CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = target_user_id
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = target_user_id
      AND role = 'super_admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT public.is_admin_user(auth.uid());
$$;

CREATE TABLE IF NOT EXISTS public.governance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role public.app_role,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  before_snapshot JSONB,
  after_snapshot JSONB
);

ALTER TABLE public.governance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read governance audit log" ON public.governance_audit_log;
CREATE POLICY "Admins can read governance audit log" ON public.governance_audit_log
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "No client inserts on governance audit log" ON public.governance_audit_log;
CREATE POLICY "No client inserts on governance audit log" ON public.governance_audit_log
  FOR INSERT WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reporter_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  reason_code TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','in_review','resolved','dismissed','escalated')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  assigned_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_code TEXT,
  resolution_note TEXT
);

CREATE TABLE IF NOT EXISTS public.report_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role public.app_role,
  action_type TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own reports and admins can read all" ON public.reports;
CREATE POLICY "Users can read own reports and admins can read all" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage reports" ON public.reports;
CREATE POLICY "Admins can manage reports" ON public.reports
  FOR UPDATE USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can read report actions" ON public.report_actions;
CREATE POLICY "Admins can read report actions" ON public.report_actions
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "No client inserts on report actions" ON public.report_actions;
CREATE POLICY "No client inserts on report actions" ON public.report_actions
  FOR INSERT WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_governance_audit_log_created_at ON public.governance_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_audit_log_actor ON public.governance_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_governance_audit_log_target ON public.governance_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON public.reports(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_actions_report_id ON public.report_actions(report_id);

COMMIT;
