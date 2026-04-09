"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useGetMyVerificationApplications,
  useSubmitVerificationApplication,
  useUpdateMyVerificationApplication,
} from "@/lib/react-query/queriesAndMutations";

const VerificationApplicationPanel = () => {
  const { data, isLoading } = useGetMyVerificationApplications();
  const submitMutation = useSubmitVerificationApplication();
  const updateMutation = useUpdateMyVerificationApplication();

  const [applicationType, setApplicationType] = useState<"person" | "creator" | "organization">("person");
  const [requestedBadgeType, setRequestedBadgeType] = useState<"verified" | "official">("verified");
  const [referenceId, setReferenceId] = useState("");
  const [notes, setNotes] = useState("");

  const latestApplication = useMemo(() => {
    const apps = data?.applications || [];
    return apps[0] || null;
  }, [data]);

  const canSubmit = !latestApplication || !latestApplication.active;
  const canWithdraw = latestApplication && ["submitted", "under_review", "needs_resubmission"].includes(latestApplication.status);
  const canResubmit = latestApplication && ["needs_resubmission", "rejected"].includes(latestApplication.status);

  const onSubmit = () => {
    submitMutation.mutate({
      applicationType,
      requestedBadgeType,
      evidencePayload: {
        reference_id: referenceId,
        notes,
      },
    });
  };

  return (
    <div className="w-full mt-4 rounded-xl border border-dark-4 bg-dark-3/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="base-semibold text-light-1">Verification</h3>
        {latestApplication && (
          <span className="text-xs text-light-3">Status: {String(latestApplication.status).replace(/_/g, " ")}</span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-light-4 mt-3">Loading verification status...</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              className="h-10 rounded-md bg-dark-4 px-3 text-sm text-light-1"
              value={applicationType}
              onChange={(e) => setApplicationType(e.target.value as any)}
              disabled={!canSubmit || submitMutation.isPending}
            >
              <option value="person">Person</option>
              <option value="creator">Creator</option>
              <option value="organization">Organization</option>
            </select>

            <select
              className="h-10 rounded-md bg-dark-4 px-3 text-sm text-light-1"
              value={requestedBadgeType}
              onChange={(e) => setRequestedBadgeType(e.target.value as any)}
              disabled={!canSubmit || submitMutation.isPending}
            >
              <option value="verified">Verified</option>
              <option value="official">Official</option>
            </select>
          </div>

          <Input
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder="Reference ID"
            disabled={!canSubmit || submitMutation.isPending}
          />
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            disabled={!canSubmit || submitMutation.isPending}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="shad-button_primary"
              disabled={!canSubmit || submitMutation.isPending}
              onClick={onSubmit}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit verification"}
            </Button>

            {canWithdraw && latestApplication && (
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ applicationId: latestApplication.id, input: { action: "withdraw" } })}
              >
                Withdraw
              </Button>
            )}

            {canResubmit && latestApplication && (
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    applicationId: latestApplication.id,
                    input: { action: "resubmit", evidencePayload: { reference_id: referenceId, notes } },
                  })
                }
              >
                Resubmit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationApplicationPanel;
