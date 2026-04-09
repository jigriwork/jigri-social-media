-- Phase 4B verification & trust migration
-- Extends existing Phase 4A governance foundation.
-- Canonical role system remains users.role (app_role)
-- Canonical audit stream remains governance_audit_log

BEGIN;

-- -------------------------------------------------------------------
-- Users lightweight verification fields (fast read-path for badges)
-- -------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_badge_type TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_verification_badge_type_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_verification_badge_type_check
      CHECK (
        verification_badge_type IS NULL OR
        verification_badge_type IN ('verified', 'official')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_verification_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_verification_status_check
      CHECK (verification_status IN ('none', 'pending', 'verified', 'revoked'));
  END IF;
END $$;

-- -------------------------------------------------------------------
-- Verification application workflow table
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  applicant_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN (
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'revoked',
      'needs_resubmission',
      'withdrawn'
    )),

  application_type TEXT NOT NULL DEFAULT 'person'
    CHECK (application_type IN ('person', 'creator', 'organization')),

  requested_badge_type TEXT NOT NULL DEFAULT 'verified'
    CHECK (requested_badge_type IN ('verified', 'official')),

  evidence_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_notes TEXT,
  rejection_reason_code TEXT,

  reviewed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  final_decision_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  final_decision_at TIMESTAMPTZ,

  resubmission_count INTEGER NOT NULL DEFAULT 0,
  cooldown_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_applications_evidence_payload_object_check'
  ) THEN
    ALTER TABLE public.verification_applications
      ADD CONSTRAINT verification_applications_evidence_payload_object_check
      CHECK (jsonb_typeof(evidence_payload) = 'object');
  END IF;
END $$;

-- One active verification application per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_applications_one_active_per_user
  ON public.verification_applications(applicant_user_id)
  WHERE active = true;

-- -------------------------------------------------------------------
-- Verification timeline table
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  application_id UUID NOT NULL REFERENCES public.verification_applications(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role public.app_role,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- -------------------------------------------------------------------
-- RLS policies
-- -------------------------------------------------------------------
ALTER TABLE public.verification_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_application_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own verification applications" ON public.verification_applications;
CREATE POLICY "Users can read own verification applications" ON public.verification_applications
  FOR SELECT USING (auth.uid() = applicant_user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can create own verification applications" ON public.verification_applications;
CREATE POLICY "Users can create own verification applications" ON public.verification_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_user_id);

DROP POLICY IF EXISTS "Users can update own pending verification applications" ON public.verification_applications;
CREATE POLICY "Users cannot directly update verification applications" ON public.verification_applications
  FOR UPDATE USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Admins can manage verification applications" ON public.verification_applications;
CREATE POLICY "Admins can manage verification applications" ON public.verification_applications
  FOR UPDATE USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users and admins can read verification events" ON public.verification_application_events;
CREATE POLICY "Users and admins can read verification events" ON public.verification_application_events
  FOR SELECT USING (
    public.is_current_user_admin() OR
    EXISTS (
      SELECT 1
      FROM public.verification_applications va
      WHERE va.id = verification_application_events.application_id
        AND va.applicant_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "No client inserts on verification events" ON public.verification_application_events;
CREATE POLICY "No client inserts on verification events" ON public.verification_application_events
  FOR INSERT WITH CHECK (false);

-- -------------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON public.users(is_verified);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON public.users(verification_status);

CREATE INDEX IF NOT EXISTS idx_verification_applications_status
  ON public.verification_applications(status);
CREATE INDEX IF NOT EXISTS idx_verification_applications_created_at
  ON public.verification_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_applications_applicant
  ON public.verification_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_verification_applications_applicant_status
  ON public.verification_applications(applicant_user_id, status);

CREATE INDEX IF NOT EXISTS idx_verification_events_application
  ON public.verification_application_events(application_id);
CREATE INDEX IF NOT EXISTS idx_verification_events_created_at
  ON public.verification_application_events(created_at DESC);

COMMIT;
