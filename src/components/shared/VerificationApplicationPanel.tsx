"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useGetMyVerificationApplications,
  useSubmitVerificationApplication,
  useUpdateMyVerificationApplication,
} from "@/lib/react-query/queriesAndMutations";
import { uploadVerificationDocument } from "@/lib/supabase/api";

const OFFICIAL_CATEGORIES = [
  { value: "government_official", label: "Government Official" },
  { value: "police", label: "Police / Law Enforcement" },
  { value: "government_department", label: "Government Department / Institution" },
  { value: "political_party", label: "Political Party" },
  { value: "public_service", label: "Public Service / Civic Authority" },
  { value: "other_official", label: "Other Official Role" },
];

const VerificationApplicationPanel = () => {
  const { data, isLoading } = useGetMyVerificationApplications();
  const submitMutation = useSubmitVerificationApplication();
  const updateMutation = useUpdateMyVerificationApplication();

  const [applicationType, setApplicationType] = useState<"person" | "creator" | "organization">("person");
  const [requestedBadgeType, setRequestedBadgeType] = useState<"verified" | "official">("verified");
  const [referenceId, setReferenceId] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [officialCategory, setOfficialCategory] = useState("");
  const [officialTitle, setOfficialTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUpload, setDocumentUpload] = useState<{ url: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  const latestApplication = useMemo(() => {
    const apps = data?.applications || [];
    return apps[0] || null;
  }, [data]);

  const canSubmit = !latestApplication || !latestApplication.active;
  const canWithdraw = latestApplication && ["submitted", "under_review", "needs_resubmission"].includes(latestApplication.status);
  const canResubmit = latestApplication && ["needs_resubmission", "rejected"].includes(latestApplication.status);

  const hasSupportingDocument = Boolean(referenceId.trim() || referenceUrl.trim());
  const allowsOfficial = applicationType === "person";
  const requiresOfficialDocument = requestedBadgeType === "official";

  const statusLabel = latestApplication
    ? String(latestApplication.status).replace(/_/g, " ")
    : "not submitted";

  useEffect(() => {
    if (!allowsOfficial && requestedBadgeType === "official") {
      setRequestedBadgeType("verified");
    }
  }, [allowsOfficial, requestedBadgeType]);

  const onSubmit = () => {
    submitMutation.mutate({
      applicationType,
      requestedBadgeType,
      evidencePayload: {
        reference_id: referenceId,
        reference_url: referenceUrl,
        document_url: documentUpload?.url || "",
        document_name: documentUpload?.name || "",
        notes,
        official_category: officialCategory,
        official_title: officialTitle,
      },
    });
  };

  const handleDocumentUpload = async () => {
    if (!documentFile) return;
    setUploadError("");
    setIsUploadingDocument(true);

    try {
      const uploaded = await uploadVerificationDocument(documentFile);
      setDocumentUpload({ url: uploaded.url, name: uploaded.name });
    } catch (error: any) {
      setUploadError(error?.message || "Failed to upload document.");
    } finally {
      setIsUploadingDocument(false);
    }
  };

  return (
    <div className="w-full mt-4 rounded-xl border border-dark-4 bg-dark-3/20 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="base-semibold text-light-1">Verification Center</h3>
          <p className="text-xs text-light-3 mt-1">
            Request a trusted badge for your profile. Verified is for creators, businesses, and general public accounts. Official is only for real public/official roles and institutions with documents.
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-dark-4 text-light-2 border border-dark-4">
          Status: {statusLabel}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-light-4 mt-3">Loading verification status...</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-light-3 mb-1">Application type</p>
              <select
              className="h-10 rounded-md bg-dark-4 px-3 text-sm text-light-1 w-full border border-dark-4"
              value={applicationType}
              onChange={(e) => setApplicationType(e.target.value as any)}
              disabled={!canSubmit || submitMutation.isPending}
            >
              <option value="person">Person</option>
              <option value="creator">Creator</option>
              <option value="organization">Organization</option>
            </select>
            </div>

            <div>
              <p className="text-xs text-light-3 mb-1">Badge type</p>
              <select
              className="h-10 rounded-md bg-dark-4 px-3 text-sm text-light-1 w-full border border-dark-4"
              value={requestedBadgeType}
              onChange={(e) => setRequestedBadgeType(e.target.value as any)}
              disabled={!canSubmit || submitMutation.isPending}
            >
              <option value="verified">Verified</option>
              {allowsOfficial && <option value="official">Official</option>}
            </select>
            </div>
          </div>

          {!allowsOfficial && (
            <div className="rounded-md border border-dark-4 bg-dark-4/20 p-3">
              <p className="text-xs text-light-3">
                <span className="text-light-2 font-semibold">Badge rule:</span> creators should use the <span className="text-primary-500">verified</span> badge.
                Official is for public officials, police, government institutions, political parties, and similar verified public entities only.
              </p>
            </div>
          )}

          <div className="rounded-md border border-dark-4 bg-dark-4/20 p-3">
            <p className="text-xs text-light-3">
              <span className="text-light-2 font-semibold">Tip:</span> Add either a document reference ID or a reliable public link.
              For <span className="text-amber-300">Official</span>, include institution proof (website, registration, government listing).
            </p>
          </div>

          {requestedBadgeType === "official" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-light-3 mb-1">Official role / category</p>
                <select
                  className="h-10 rounded-md bg-dark-4 px-3 text-sm text-light-1 w-full border border-dark-4"
                  value={officialCategory}
                  onChange={(e) => setOfficialCategory(e.target.value)}
                  disabled={!canSubmit || submitMutation.isPending}
                >
                  <option value="">Select official category</option>
                  {OFFICIAL_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-light-3 mb-1">Official title / position</p>
                <Input
                  value={officialTitle}
                  onChange={(e) => setOfficialTitle(e.target.value)}
                  placeholder="Example: Police Inspector, Department Head"
                  disabled={!canSubmit || submitMutation.isPending}
                />
              </div>
            </div>
          )}

          <Input
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder="Supporting document reference ID"
            disabled={!canSubmit || submitMutation.isPending}
          />
          <Input
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="Supporting document URL"
            disabled={!canSubmit || submitMutation.isPending}
          />

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write a short statement about why your account should be verified"
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full rounded-md bg-dark-4 border border-dark-4 px-3 py-2 text-sm text-light-1 placeholder:text-light-4 min-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary-500"
          />

          {requiresOfficialDocument && (
            <div className="rounded-md border border-dark-4 bg-dark-4/20 p-3 space-y-3">
              <div>
                <p className="text-xs text-light-2 font-semibold">Official document upload *</p>
                <p className="text-xs text-light-3 mt-1">
                  Upload ID card, appointment/order letter, or official proof of role. This is mandatory for official badge review.
                </p>
              </div>

              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  setDocumentFile(e.target.files?.[0] || null);
                  setUploadError("");
                }}
                disabled={!canSubmit || submitMutation.isPending || isUploadingDocument}
              />

              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDocumentUpload}
                  disabled={!documentFile || isUploadingDocument || !canSubmit || submitMutation.isPending}
                >
                  {isUploadingDocument ? "Uploading..." : "Upload document"}
                </Button>

                {documentUpload && (
                  <span className="text-xs text-green-400">Uploaded: {documentUpload.name}</span>
                )}
              </div>

              {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="shad-button_primary"
              disabled={
                !canSubmit ||
                submitMutation.isPending ||
                !hasSupportingDocument ||
                (requestedBadgeType === "official" && (!officialCategory || !documentUpload?.url))
              }
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
                    input: {
                      action: "resubmit",
                      evidencePayload: {
                        reference_id: referenceId,
                        reference_url: referenceUrl,
                        document_url: documentUpload?.url || "",
                        document_name: documentUpload?.name || "",
                        notes,
                        official_category: officialCategory,
                        official_title: officialTitle,
                      },
                    },
                  })
                }
              >
                Resubmit
              </Button>
            )}

          {!hasSupportingDocument && canSubmit && (
            <p className="text-xs text-red-400">Supporting document is mandatory. Add reference ID or URL.</p>
          )}

          {requestedBadgeType === "official" && !officialCategory && canSubmit && (
            <p className="text-xs text-red-400">Select the official role/category.</p>
          )}

          {requestedBadgeType === "official" && !documentUpload?.url && canSubmit && (
            <p className="text-xs text-red-400">Official applications require uploaded proof documents.</p>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationApplicationPanel;
