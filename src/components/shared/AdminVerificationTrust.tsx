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
      <div className="bg-dark-2/50 rounded-xl p-4 md:p-6 border border-dark-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h3 className="text-xl font-semibold text-light-1">Verification &amp; Trust</h3>
          <span className="text-xs text-light-3">Role: {role.replace(/_/g, " ")}</span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-full ${status === opt.value
                  ? "bg-primary-500 text-white"
                  : "bg-dark-3 text-light-3 hover:text-light-1"
                }`}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-dark-4 bg-dark-3/20 p-3 max-h-[560px] overflow-y-auto min-w-0">
            {isQueueLoading ? (
              <div className="flex-center py-8">
                <Loader />
              </div>
            ) : applications.length === 0 ? (
              <p className="text-sm text-light-4 py-6 text-center">No verification applications in this queue.</p>
            ) : (
              <div className="space-y-2">
                {applications.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedId === item.id
                        ? "border-primary-500 bg-primary-500/10"
                        : "border-dark-4 bg-dark-3/30 hover:border-primary-500/30"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-light-1 font-semibold line-clamp-1">{item?.applicant?.name || "Unknown user"}</p>
                      <span className="text-[10px] text-light-3">{String(item.status).replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-light-3">@{item?.applicant?.username || "unknown"}</p>
                    <p className="text-[11px] text-light-4 mt-1">
                      Requested: {item.requested_badge_type} • {new Date(item.created_at).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {!!queueData?.pagination && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-4">
                <span className="text-xs text-light-4">
                  Page {queueData.pagination.page} / {Math.max(1, queueData.pagination.totalPages)}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= (queueData.pagination.totalPages || 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dark-4 bg-dark-3/20 p-3 min-h-[260px] min-w-0">
            {!selectedId ? (
              <p className="text-sm text-light-4 py-6 text-center">Select an application to review details.</p>
            ) : isDetailLoading ? (
              <div className="flex-center py-8">
                <Loader />
              </div>
            ) : !selected ? (
              <p className="text-sm text-light-4 py-6 text-center">Application details unavailable.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-light-1 font-semibold">{selected?.applicant?.name || "Unknown user"}</p>
                  <p className="text-xs text-light-3">@{selected?.applicant?.username || "unknown"}</p>
                  <p className="text-[11px] text-light-4 mt-1">Current status: {String(selected.status).replace(/_/g, " ")}</p>
                </div>

                <div className="rounded-md border border-dark-4 bg-dark-4/30 p-2">
                  <p className="text-xs text-light-3">Application type: {selected.application_type}</p>
                  <p className="text-xs text-light-3">Requested badge: {selected.requested_badge_type}</p>
                  <p className="text-xs text-light-3">Resubmissions: {selected.resubmission_count || 0}</p>
                </div>

                <div className="rounded-md border border-dark-4 bg-dark-4/20 p-2 text-xs text-light-3">
                  <p><span className="text-light-2 font-semibold">Reject:</span> deny request before any verification is granted.</p>
                  <p><span className="text-light-2 font-semibold">Revoke verification:</span> remove existing verified/official badge from an already approved account.</p>
                </div>

                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Review notes for the applicant (optional)"
                  className="min-h-[96px] bg-dark-4 border-dark-4 text-light-1 placeholder:text-light-4"
                />
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for reject / revoke / resubmission request"
                  className="min-h-[96px] bg-dark-4 border-dark-4 text-light-1 placeholder:text-light-4"
                />

                {actionError ? <p className="text-xs text-red-400">{actionError}</p> : null}

                <select
                  value={badgeType}
                  onChange={(e) => setBadgeType(e.target.value as "verified" | "official")}
                  className="h-10 rounded-md bg-dark-4 border border-dark-4 px-3 text-sm text-light-1 w-full"
                >
                  <option value="verified">Verified</option>
                  <option value="official">Official</option>
                </select>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => onAction("under_review")} disabled={updateMutation.isPending}>
                    Mark under review
                  </Button>
                  <Button size="sm" className="shad-button_primary" onClick={() => onAction("approved")} disabled={!canFinalize || updateMutation.isPending}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onAction("needs_resubmission")} disabled={updateMutation.isPending}>
                    Request resubmission
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onAction("rejected")} disabled={!canFinalize || updateMutation.isPending}>
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction("revoked")}
                    disabled={!canFinalize || updateMutation.isPending || selected.status !== "approved"}
                  >
                    Remove verification (revoke)
                  </Button>
                  {canOverride && (
                    <Button size="sm" variant="outline" onClick={() => onAction("approved", true)} disabled={updateMutation.isPending}>
                      Super admin override approve
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminVerificationTrust;
