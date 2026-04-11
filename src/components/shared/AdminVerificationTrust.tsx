"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  useGetAdminVerificationApplications,
  useGetAdminVerificationApplicationDetails,
  useUpdateAdminVerificationApplication,
} from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/SupabaseAuthContext";
import Loader from "@/components/shared/Loader";
import { Textarea } from "@/components/ui/textarea";

type ReviewActionStatus =
  | "under_review"
  | "approved"
  | "rejected"
  | "needs_resubmission"
  | "revoked";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "needs_resubmission", label: "Needs resubmission" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "revoked", label: "Revoked" },
  { value: "withdrawn", label: "Withdrawn" },
];

const STATUS_STYLES: Record<string, string> = {
  submitted: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  under_review: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  needs_resubmission: "border-orange-500/30 bg-orange-500/15 text-orange-300",
  approved: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  rejected: "border-rose-500/30 bg-rose-500/15 text-rose-300",
  revoked: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300",
  withdrawn: "border-slate-500/30 bg-slate-500/15 text-slate-300",
};

const BADGE_STYLES: Record<string, string> = {
  verified: "border-primary-500/30 bg-primary-500/15 text-primary-300",
  official: "border-violet-500/30 bg-violet-500/15 text-violet-300",
};

const AdminVerificationTrust = () => {
  const { user } = useUserContext();
  const role = ((user as any)?.role || "user") as "user" | "moderator" | "admin" | "super_admin";

  const [status, setStatus] = useState("submitted");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [badgeType, setBadgeType] = useState<"verified" | "official">("verified");
  const [actionError, setActionError] = useState("");

  const { data: queueData, isLoading: isQueueLoading } = useGetAdminVerificationApplications(page, 12, status, "all");
  const { data: detailData, isLoading: isDetailLoading } = useGetAdminVerificationApplicationDetails(selectedId, {
    enabled: !!selectedId,
  });
  const updateMutation = useUpdateAdminVerificationApplication();

  const applications = queueData?.applications || [];
  const selected = detailData?.application;
  const canFinalize = role === "admin" || role === "super_admin";
  const canOverride = role === "super_admin";

  const queueStats = useMemo(() => {
    const total = applications.length;
    const approved = applications.filter((item: any) => item.status === "approved").length;
    const inReview = applications.filter((item: any) => item.status === "under_review").length;
    const flagged = applications.filter((item: any) => ["rejected", "needs_resubmission", "revoked"].includes(item.status)).length;
    return { total, approved, inReview, flagged };
  }, [applications]);

  const requiredReason = useMemo(() => {
    return ["rejected", "needs_resubmission", "revoked"];
  }, []);

  useEffect(() => {
    setActionError("");
  }, [selectedId, status]);

  const onAction = (nextStatus: ReviewActionStatus, forceOverride: boolean = false) => {
    if (!selectedId) return;

    if (requiredReason.includes(nextStatus) && !reason.trim()) {
      setActionError("Reason is required for reject, revoke, or resubmission request.");
      return;
    }

    setActionError("");

    updateMutation.mutate({
      applicationId: selectedId,
      input: {
        status: nextStatus,
        reason: reason.trim() || undefined,
        reviewNotes: reviewNotes.trim() || undefined,
        badgeType,
        forceOverride,
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.8 }}
      className="mt-6 md:mt-8 w-full max-w-6xl"
    >
      <div className="relative overflow-hidden rounded-2xl border border-dark-4 bg-gradient-to-br from-dark-2 via-dark-2 to-dark-3 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_24%)]" />

        <div className="relative p-4 md:p-6">
          <div className="mb-6 space-y-5">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/25 bg-primary-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-300">
                  <span className="h-2 w-2 rounded-full bg-primary-400" />
                  Trust Operations
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-semibold text-light-1">Verification &amp; Trust</h3>
                  <p className="mt-2 text-sm md:text-base leading-6 text-light-3">
                    Review identity requests with a cleaner queue, stronger visual cues, and a more modern moderation workspace.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                <span className="rounded-full border border-dark-4 bg-dark-3/60 px-3 py-1.5 text-xs text-light-3">
                  Role: <span className="font-medium text-light-1 capitalize">{role.replace(/_/g, " ")}</span>
                </span>
                <span className="rounded-full border border-dark-4 bg-dark-3/60 px-3 py-1.5 text-xs text-light-3">
                  Queue page {queueData?.pagination?.page || 1}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-light-4">Visible Queue</p>
                <p className="text-2xl font-semibold text-light-1">{queueStats.total}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.05] p-4 backdrop-blur-sm">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-light-4">In Review</p>
                <p className="text-2xl font-semibold text-amber-300">{queueStats.inReview}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.05] p-4 backdrop-blur-sm">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-light-4">Approved</p>
                <p className="text-2xl font-semibold text-emerald-300">{queueStats.approved}</p>
              </div>
              <div className="rounded-2xl border border-rose-500/10 bg-rose-500/[0.05] p-4 backdrop-blur-sm">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-light-4">Needs Attention</p>
                <p className="text-2xl font-semibold text-rose-300">{queueStats.flagged}</p>
              </div>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                onClick={() => {
                  setStatus(opt.value);
                  setPage(1);
                }}
                className={`rounded-full border px-3.5 py-2 text-xs transition-all ${status === opt.value
                  ? "border-primary-400 bg-primary-500 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
                  : "border-dark-4 bg-dark-3/60 text-light-3 hover:border-primary-500/30 hover:text-light-1"
                  }`}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr]">
            <div className="min-w-0 rounded-2xl border border-dark-4 bg-dark-3/25 p-3 md:p-4 shadow-inner shadow-black/10">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-light-1">Application Queue</p>
                  <p className="text-xs text-light-4">Select a request to inspect evidence and finalize a trust decision.</p>
                </div>
                <span className="rounded-full border border-dark-4 bg-dark-4/40 px-2.5 py-1 text-[11px] text-light-3">
                  {applications.length} visible
                </span>
              </div>

              <div className="max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
                {isQueueLoading ? (
                  <div className="flex-center py-10">
                    <Loader />
                  </div>
                ) : applications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-dark-4 bg-dark-4/20 px-4 py-10 text-center">
                    <p className="text-sm text-light-3">No verification applications in this queue.</p>
                    <p className="mt-1 text-xs text-light-4">Try another filter to explore a different trust state.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((item: any) => {
                      const currentStatusClass = STATUS_STYLES[item.status] || "border-dark-4 bg-dark-4 text-light-3";
                      const badgeClass = BADGE_STYLES[item.requested_badge_type] || "border-dark-4 bg-dark-4 text-light-3";

                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedId === item.id
                            ? "border-primary-500 bg-primary-500/10 shadow-[0_0_0_1px_rgba(99,102,241,0.28)]"
                            : "border-dark-4 bg-dark-3/40 hover:border-primary-500/20 hover:bg-dark-3/60"
                            }`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-light-1">{item?.applicant?.name || "Unknown user"}</p>
                              <p className="truncate text-xs text-light-4">@{item?.applicant?.username || "unknown"}</p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${currentStatusClass}`}>
                              {String(item.status).replace(/_/g, " ")}
                            </span>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${badgeClass}`}>
                              {item.requested_badge_type}
                            </span>
                            <span className="rounded-full border border-dark-4 bg-dark-4/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-light-3">
                              {item.application_type}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-light-4">
                            <div className="rounded-xl bg-dark-4/20 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-light-4">Submitted</p>
                              <p className="mt-1 text-light-2">{new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="rounded-xl bg-dark-4/20 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-light-4">Updated</p>
                              <p className="mt-1 text-light-2">{new Date(item.updated_at || item.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {!!queueData?.pagination && (
                <div className="mt-4 flex items-center justify-between border-t border-dark-4 pt-4">
                  <span className="text-xs text-light-4">
                    Page {queueData.pagination.page} / {Math.max(1, queueData.pagination.totalPages)}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                      Prev
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= (queueData.pagination.totalPages || 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-2xl border border-dark-4 bg-dark-3/25 p-4 md:p-5 shadow-inner shadow-black/10">
              {!selectedId ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-dark-4 bg-dark-4/15 px-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-xl text-primary-300">✓</div>
                  <p className="font-medium text-light-2">Select an application to review details</p>
                  <p className="mt-2 max-w-md text-sm text-light-4">
                    The workspace on the right will show the trust snapshot, review notes, and action controls in a more polished layout.
                  </p>
                </div>
              ) : isDetailLoading ? (
                <div className="flex-center py-12">
                  <Loader />
                </div>
              ) : !selected ? (
                <div className="rounded-2xl border border-dashed border-dark-4 bg-dark-4/15 px-4 py-10 text-center">
                  <p className="text-sm text-light-3">Application details unavailable.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="break-words text-xl font-semibold text-light-1">{selected?.applicant?.name || "Unknown user"}</h4>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${STATUS_STYLES[selected.status] || "border-dark-4 bg-dark-4 text-light-3"}`}>
                          {String(selected.status).replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="break-all text-sm text-light-4">@{selected?.applicant?.username || "unknown"}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${BADGE_STYLES[selected.requested_badge_type] || "border-dark-4 bg-dark-4 text-light-3"}`}>
                        {selected.requested_badge_type} badge
                      </span>
                      <span className="rounded-full border border-dark-4 bg-dark-4/30 px-3 py-1.5 text-xs capitalize text-light-3">
                        {selected.application_type}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-light-4">Submitted</p>
                      <p className="mt-2 text-sm text-light-1">{new Date(selected.created_at).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-light-4">Updated</p>
                      <p className="mt-2 text-sm text-light-1">{new Date(selected.updated_at || selected.created_at).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-light-4">Resubmissions</p>
                      <p className="mt-2 text-sm text-light-1">{selected.resubmission_count || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-light-4">Applicant ID</p>
                      <p className="mt-2 truncate text-sm text-light-1">{selected.applicant_user_id}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h5 className="text-sm font-semibold text-light-1">Review Workspace</h5>
                          <span className="text-[11px] text-light-4">Notes & moderation reason</span>
                        </div>

                        <div className="space-y-3">
                          <Textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Capture reviewer context, evidence quality, policy notes, or escalation details..."
                            className="min-h-[120px] bg-dark-4 border-dark-4 text-light-1 placeholder:text-light-4"
                          />
                          <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Required for reject / revoke / needs resubmission. Keep it specific and policy-friendly."
                            className="min-h-[120px] bg-dark-4 border-dark-4 text-light-1 placeholder:text-light-4"
                          />
                          {actionError ? <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{actionError}</div> : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h5 className="text-sm font-semibold text-light-1">Action Controls</h5>
                          <span className="text-[11px] text-light-4">Badge output & final decision</span>
                        </div>

                        <select
                          value={badgeType}
                          onChange={(e) => setBadgeType(e.target.value as "verified" | "official")}
                          className="mb-4 h-11 w-full rounded-xl bg-dark-4 border border-dark-4 px-3 text-sm text-light-1"
                        >
                          <option value="verified">Verified</option>
                          <option value="official">Official</option>
                        </select>

                        <div className="flex flex-col gap-3 w-full mt-2">
                          <Button size="sm" variant="outline" onClick={() => onAction("under_review")} disabled={updateMutation.isPending} className="w-full justify-center">
                            Mark under review
                          </Button>
                          <Button size="sm" className="shad-button_primary w-full justify-center" onClick={() => onAction("approved")} disabled={!canFinalize || updateMutation.isPending}>
                            Approve application
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onAction("needs_resubmission")} disabled={updateMutation.isPending} className="w-full justify-center">
                            Request resubmission
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onAction("rejected")} disabled={!canFinalize || updateMutation.isPending} className="w-full justify-center">
                            Reject request
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onAction("revoked")} disabled={!canFinalize || updateMutation.isPending || selected.status !== "approved"} className="w-full justify-center">
                            Remove verification (revoke)
                          </Button>
                          {canOverride && (
                            <Button size="sm" variant="outline" onClick={() => onAction("approved", true)} disabled={updateMutation.isPending} className="w-full justify-center border-violet-500/30 text-violet-300 hover:bg-violet-500/10">
                              Super admin override approve
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-4">
                        <h5 className="mb-3 text-sm font-semibold text-light-1">Application Snapshot</h5>
                        <div className="space-y-3 text-sm text-light-3">
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-light-4">Application type</span>
                            <span className="text-right text-light-1 capitalize">{selected.application_type}</span>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-light-4">Requested badge</span>
                            <span className="text-right text-light-1 capitalize">{selected.requested_badge_type}</span>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-light-4">Current status</span>
                            <span className="text-right text-light-1 capitalize">{String(selected.status).replace(/_/g, " ")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-4">
                        <h5 className="mb-3 text-sm font-semibold text-light-1">Policy Guidance</h5>
                        <div className="space-y-2 text-xs leading-6 text-light-3">
                          <p><span className="text-light-2 font-semibold">Reject</span> when the request should not proceed and no badge should be issued.</p>
                          <p><span className="text-light-2 font-semibold">Needs resubmission</span> when identity proof exists but evidence is incomplete or unclear.</p>
                          <p><span className="text-light-2 font-semibold">Revoke</span> only when an approved account must lose its verification state.</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dark-4 bg-dark-4/20 p-4">
                        <h5 className="mb-2 text-sm font-semibold text-light-1">Reviewer Power</h5>
                        <p className="text-xs leading-6 text-light-3">
                          {canOverride
                            ? "You have super admin override access and can force-approve when operationally necessary."
                            : canFinalize
                              ? "You can finalize trust decisions for this queue based on moderation policy."
                              : "You can review and annotate applications, but final actions are limited by role."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminVerificationTrust;
