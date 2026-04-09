# PHASE 4B — VERIFICATION & TRUST PLAN (ALL COMBINED)

## 0) Guardrails (Non-Negotiable)

This plan explicitly preserves Phase 4A governance foundations:

- **No new role model** (canonical source remains `users.role`).
- **No second admin system** (existing `/admin` remains the single governance dashboard).
- **No duplicate super-admin logic** (existing hierarchy remains authoritative).
- **No replacement of governance audit** (existing `governance_audit_log` remains the canonical audit stream).
- Verification/trust is implemented as an **extension layer** on top of current governance.

---

## 1) Recommended Verification Architecture for Jigri

### 1.1 Core principle

Use a **dedicated verification domain table set** (workflow/history), while keeping **lightweight display fields** on `users` for fast UI rendering.

Why this hybrid:

- Workflow, evidence, and decision history are complex and should not overload `users`.
- UI surfaces (feed/comments/cards/profile) need fast read-path flags from `users`.
- Avoids future rework (supports re-verify, revoke, appeals, badge variants).

### 1.2 Data model (recommended)

#### A) `verification_applications` (new; canonical workflow entity)

Stores each submission lifecycle.

Suggested columns:

- `id` UUID PK
- `created_at`, `updated_at`
- `applicant_user_id` UUID FK → `users.id`
- `status` TEXT CHECK IN:
  - `draft`
  - `submitted`
  - `under_review`
  - `approved`
  - `rejected`
  - `revoked`
  - `needs_resubmission`
  - `withdrawn`
- `application_type` TEXT CHECK IN:
  - `person`
  - `creator`
  - `organization`
- `requested_badge_type` TEXT CHECK IN:
  - `verified`
  - `official`
  - `notable` (optional future)
- `evidence_payload` JSONB (minimal, structured)
- `review_notes` TEXT
- `reviewed_by_user_id` UUID FK → `users.id`
- `reviewed_at` TIMESTAMPTZ
- `final_decision_by_user_id` UUID FK → `users.id` (for super_admin override/finalization clarity)
- `final_decision_at` TIMESTAMPTZ
- `rejection_reason_code` TEXT
- `resubmission_count` INT DEFAULT 0
- `active` BOOLEAN DEFAULT true (single active application per user constraint)

#### B) `verification_application_events` (new; domain event timeline)

Detailed immutable timeline for each application.

Suggested columns:

- `id` UUID PK
- `created_at`
- `application_id` UUID FK → `verification_applications.id`
- `actor_user_id` UUID FK → `users.id`
- `actor_role` `app_role`
- `event_type` TEXT (e.g., `submitted`, `assigned`, `status_changed`, `approved`, `rejected`, `revoked`, `override`)
- `from_status`, `to_status`
- `reason` TEXT
- `metadata` JSONB

#### C) `user_verification_profile` (optional new table OR minimal users columns)

To avoid duplication, prefer one of two options:

- **Option Preferred for launch**: add minimal columns directly on `users`:
  - `is_verified` BOOLEAN DEFAULT false
  - `verification_badge_type` TEXT NULL (`verified` / `official` / `notable`)
  - `verification_status` TEXT NULL (`none` / `verified` / `revoked`)
  - `verification_updated_at` TIMESTAMPTZ
- **Option Future scale**: separate `user_verification_profile` if trust dimensions grow significantly.

For Phase 4B launch, use **users columns** for display simplicity and performance.

### 1.3 Trust level strategy

Do **not** introduce a complex score yet (prevents pseudo-ML trust drift).

Launch-safe trust signals:

- `is_verified` (boolean)
- `verification_badge_type` (limited enum)
- optional `trust_level` as **simple enum** (`standard`, `verified`) only if needed in UI logic.

Avoid numeric trust scoring in Phase 4B.

---

## 2) Application Workflow

### 2.1 User flow

1. User opens Verification page (or Profile → Get verified).
2. User fills required fields and uploads evidence metadata.
3. User submits; app creates `verification_applications` row with `status='submitted'`.
4. System writes domain event + governance audit entry.

### 2.2 Admin review lifecycle

Lifecycle transitions:

- `draft → submitted`
- `submitted → under_review`
- `under_review → approved`
- `under_review → rejected`
- `under_review → needs_resubmission`
- `approved → revoked` (admin/super_admin)
- `submitted/under_review → withdrawn` (user)

### 2.3 Resubmission logic

- Only one active application per user.
- If `rejected` or `needs_resubmission`, user can create a new submission or re-open same record via controlled endpoint.
- Enforce cooldown windows to reduce spam (e.g., 7 days after rejection unless `needs_resubmission`).
- Cap `resubmission_count` before forced manual escalation.

### 2.4 Decision consistency rules

- On `approved`: update `users.is_verified=true`, set badge/status fields.
- On `rejected`: keep verification flags off.
- On `revoked`: set `is_verified=false`, status `revoked`, preserve reason/audit.
- Use transaction boundaries so application status + user badge state remain consistent.

---

## 3) Role Responsibilities (No New Role System)

Uses existing role hierarchy (`moderator < admin < super_admin`).

### Moderator

- View queue (read-only) OR limited triage depending policy.
- Can mark `under_review` and add internal notes if enabled.
- Cannot approve/reject/revoke by default for launch-safe policy.

### Admin

- Full operational review:
  - move application through review states
  - approve/reject
  - request resubmission
  - revoke verification (with reason)
- Cannot bypass super-admin protected decisions when override is locked.

### Super Admin

- Final authority for:
  - override decisions
  - forced approval/revocation
  - policy exception handling
- Has explicit `final_decision_*` markers in verification records.

### Final authority

- **Super_admin is final escalation authority**.
- Normal path: admin handles majority.
- Escalation path: super_admin resolves disputed/high-risk cases.

---

## 4) Audit Logging Design

### 4.1 Canonical audit stream (required)

All verification actions must write to existing `governance_audit_log` using `logGovernanceAudit` with:

- `action_type` examples:
  - `verification_application_submitted`
  - `verification_status_changed`
  - `verification_approved`
  - `verification_rejected`
  - `verification_resubmission_requested`
  - `verification_revoked`
  - `verification_super_admin_override`
- `target_type='verification_application'` (and `user` where needed)
- `target_id` = application id or user id as context
- `metadata` includes reason codes, badge type, evidence summary keys (not raw sensitive docs)
- `before_snapshot` / `after_snapshot` for status transitions

### 4.2 Domain-level event table (recommended)

Use `verification_application_events` for product timeline UX and debugging.

- Governance audit remains compliance-grade cross-domain log.
- Event table remains verification-domain timeline.
- This is complementary, not duplicate trust/governance.

---

## 5) UI/UX Surface Plan

### 5.1 End-user surfaces

Badge appears on:

- Profile header (primary)
- Feed/post header beside username
- Comment author row
- User cards (suggested users / followers lists)

Display states:

- Verified badge if `users.is_verified=true`
- Optional tooltip: badge type (`Verified`, `Official`)

### 5.2 User verification status page

Add a dedicated user-facing page:

- Application state card (submitted/under review/etc.)
- Last decision reason if rejected/revoked
- CTA for resubmission when eligible

### 5.3 Admin dashboard integration (`/admin` only)

No new dashboard. Add a **Verification & Trust** section/tabs in current `/admin`:

- Queue list (submitted/under_review/needs_resubmission)
- Filters: status, date, reviewer
- Application detail panel with evidence summary
- Action controls by role permissions
- Timeline (from `verification_application_events` + `governance_audit_log` references)

---

## 6) Trust, Abuse, Privacy & Launch Safety

### 6.1 Fake application controls

- Cooldown after rejection
- Submission rate limits per user/IP
- Required structured evidence fields per application type

### 6.2 Revoked verification behavior

- Immediate badge removal from UI read-path (`users.is_verified=false`)
- Public-facing profile may show historical note only if policy requires (optional)

### 6.3 Badge misuse prevention

- Badge is server-driven only from trusted DB fields
- No client-side derived badge logic
- All state changes through role-protected APIs

### 6.4 Evidence storage/privacy

- Store files in restricted Supabase Storage bucket/private path
- Store only references/metadata in DB (`evidence_payload`)
- Avoid logging PII-heavy evidence in audit metadata
- Enforce retention policy and secure access by role

### 6.5 Minimal safe launch workflow

- Admin+super_admin review only (moderator optional read)
- Manual decision reason required for reject/revoke
- Full audit writes mandatory
- No numerical trust score in v1

---

## 7) Migration & Implementation Strategy (No Rework)

### Phase 4B Step Plan

1. **Schema migration**
   - Create `verification_applications`
   - Create `verification_application_events`
   - Add minimal verification display columns to `users`
   - Add indexes + RLS policies

2. **Backend APIs (extend existing governance style)**
   - User endpoints: create/view own application, resubmit, withdraw
   - Admin endpoints under existing `/api/admin/...` namespace for review actions
   - Reuse `requireMinRole`, `getCurrentGovernanceContext`, `logGovernanceAudit`

3. **Admin UI integration**
   - Add section in existing `/admin` dashboard, not separate dashboard
   - Role-based actions using current role checks

4. **Badge rendering rollout**
   - Read from `users.is_verified` and `verification_badge_type` across profile/feed/comment/user-card

5. **Audit verification**
   - Ensure every transition writes both domain event + governance audit

6. **Backfill / no-op migration safety**
   - Existing users default `is_verified=false`
   - No impact on current role/admin/report systems

### Anti-duplication commitments

- No new `roles` table.
- No second audit framework.
- No second admin dashboard.
- No trust engine that conflicts with verification flags.

---

## 8) Ready-for-Implementation Assessment

This plan is implementation-ready for Phase 4B because:

- It extends current Phase 4A governance primitives directly.
- It preserves canonical role and admin ownership models.
- It introduces minimal but scalable verification state architecture.
- It prevents rework by separating workflow history from user display flags.

Recommended implementation mode: **incremental rollout behind admin-reviewed path first**, then full user application exposure.
