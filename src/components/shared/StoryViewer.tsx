"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoryGroup } from "@/lib/supabase/api";
import { useDeleteStory, useRecordStoryView } from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/SupabaseAuthContext";
import VerificationBadge from "./VerificationBadge";
import ConfirmActionModal from "./ConfirmActionModal";

type StoryViewerProps = {
    open: boolean;
    groups: StoryGroup[];
    initialGroupIndex: number;
    initialStoryIndex?: number;
    onClose: () => void;
    onAddStory?: () => void;
    onStoryDeleted?: () => void;
};

const STORY_DURATION = 6000;
const HOLD_THRESHOLD_MS = 220;

const StoryViewer = ({
    open,
    groups,
    initialGroupIndex,
    initialStoryIndex = 0,
    onClose,
    onAddStory,
    onStoryDeleted,
}: StoryViewerProps) => {
    const { user } = useUserContext();
    const { mutate: recordView } = useRecordStoryView();
    const { mutateAsync: deleteStory, isPending: isDeleting } = useDeleteStory();

    const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
    const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [showViewersPanel, setShowViewersPanel] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const touchStartYRef = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const pressStartRef = useRef<number | null>(null);

    const handleHoldStart = useCallback(() => {
        pressStartRef.current = Date.now();
        setPaused(true);
    }, []);

    const handleHoldEnd = useCallback((onTap?: () => void) => {
        const startedAt = pressStartRef.current;
        pressStartRef.current = null;
        setPaused(false);

        if (startedAt !== null && onTap) {
            const holdDuration = Date.now() - startedAt;
            if (holdDuration < HOLD_THRESHOLD_MS) {
                onTap();
            }
        }
    }, []);

    useEffect(() => {
        if (open) {
            setGroupIndex(initialGroupIndex);
            setStoryIndex(initialStoryIndex);
            setProgress(0);
            setPaused(false);
            setShowViewersPanel(false);
            setShowDeleteConfirm(false);
        }
    }, [open, initialGroupIndex, initialStoryIndex]);

    const currentGroup = groups[groupIndex];
    const currentStory = currentGroup?.stories?.[storyIndex];
    const isOwnerStory = currentStory?.user_id === user?.id;

    const nextTarget = useMemo(() => {
        if (!currentGroup) return null;
        if (storyIndex < currentGroup.stories.length - 1) return { g: groupIndex, s: storyIndex + 1 };
        if (groupIndex < groups.length - 1) return { g: groupIndex + 1, s: 0 };
        return null;
    }, [currentGroup, storyIndex, groupIndex, groups]);

    const goNext = useCallback(() => {
        if (!currentGroup) return onClose();
        if (storyIndex < currentGroup.stories.length - 1) {
            setStoryIndex((p) => p + 1);
            setProgress(0);
            return;
        }
        if (groupIndex < groups.length - 1) {
            setGroupIndex((p) => p + 1);
            setStoryIndex(0);
            setProgress(0);
            return;
        }
        onClose();
    }, [currentGroup, storyIndex, groupIndex, groups.length, onClose]);

    const goPrev = useCallback(() => {
        if (!currentGroup) return;
        if (storyIndex > 0) {
            setStoryIndex((p) => p - 1);
            setProgress(0);
            return;
        }
        if (groupIndex > 0) {
            const prevGroup = groups[groupIndex - 1];
            setGroupIndex((p) => p - 1);
            setStoryIndex(Math.max(0, (prevGroup?.stories?.length || 1) - 1));
            setProgress(0);
        }
    }, [currentGroup, storyIndex, groupIndex, groups]);

    const handleConfirmDelete = useCallback(async () => {
        if (!currentStory) return;
        try {
            await deleteStory(currentStory.id);
            setShowDeleteConfirm(false);
            onStoryDeleted?.();
            if ((currentGroup?.stories?.length || 0) <= 1) {
                onClose();
            } else {
                goNext();
            }
        } catch (error) {
            console.error("Failed to delete story", error);
        }
    }, [currentStory, deleteStory, onStoryDeleted, currentGroup, onClose, goNext]);

    useEffect(() => {
        if (!open || paused) return;
        const step = 100 / (STORY_DURATION / 100);
        const tick = window.setInterval(() => {
            setProgress((prev) => Math.min(prev + step, 100));
        }, 100);

        return () => clearInterval(tick);
    }, [open, paused, groupIndex, storyIndex]);

    useEffect(() => {
        if (!open || currentStory?.media_type !== "video") return;

        const video = videoRef.current;
        if (!video) return;

        if (paused) {
            video.pause();
            return;
        }

        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => undefined);
        }
    }, [paused, open, currentStory?.id, currentStory?.media_type]);

    useEffect(() => {
        if (!open) return;

        const onPointerUp = () => {
            pressStartRef.current = null;
            setPaused(false);
        };
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);

        return () => {
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (progress >= 100) {
            setProgress(0);
            goNext();
        }
    }, [progress, open, goNext]);

    useEffect(() => {
        if (!open || !currentStory) return;
        setProgress(0);
        setShowViewersPanel(false);

        if (currentStory.user_id !== user?.id) {
            recordView(currentStory.id);
        }

        if (nextTarget) {
            const nextStory = groups[nextTarget.g]?.stories?.[nextTarget.s];
            if (nextStory?.media_type === "image") {
                const img = new Image();
                img.src = nextStory.media_url;
            } else if (nextStory?.media_type === "video") {
                const video = document.createElement("video");
                video.preload = "metadata";
                video.src = nextStory.media_url;
            }
        }
    }, [open, currentStory?.id]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") goNext();
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, groupIndex, storyIndex]);

    if (!open || !currentStory || !currentGroup) return null;

    const formatViewedAt = (value?: string) => {
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    };

    const timeAgo = (() => {
        const diffMs = Date.now() - new Date(currentStory.created_at).getTime();
        const m = Math.floor(diffMs / (1000 * 60));
        const h = Math.floor(diffMs / (1000 * 60 * 60));
        if (m < 1) return "just now";
        if (m < 60) return `${m}m ago`;
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    })();

    return (
        <div className="fixed inset-0 z-[120] bg-black transition-opacity duration-200">
            <div
                className="h-full w-full md:max-w-md md:mx-auto md:my-8 md:h-[92vh] md:rounded-2xl md:overflow-hidden md:border md:border-dark-4 relative"
                onTouchStart={(e) => (touchStartYRef.current = e.changedTouches[0].clientY)}
                onTouchEnd={(e) => {
                    const start = touchStartYRef.current;
                    const end = e.changedTouches[0].clientY;
                    if (start !== null && end - start > 90) onClose();
                    touchStartYRef.current = null;
                }}
            >
                <div
                    className="absolute top-0 left-0 right-0 z-20 px-3 pb-2 md:px-4"
                    style={{ paddingTop: "calc(0.65rem + env(safe-area-inset-top))" }}
                >
                    <div className="flex gap-1.5 mb-2">
                        {currentGroup.stories.map((story, i) => (
                            <div key={story.id} className="h-1.5 flex-1 bg-white/30 rounded overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all"
                                    style={{
                                        width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <img
                                src={currentGroup.user?.image_url || "/assets/icons/profile-placeholder.svg"}
                                alt="avatar"
                                className="w-9 h-9 rounded-full border border-white/20 shrink-0"
                            />
                            <p className="text-white text-sm font-medium inline-flex items-center gap-1 truncate">
                                @{currentGroup.user?.username || "user"}
                                <VerificationBadge
                                    isVerified={currentGroup.user?.is_verified}
                                    badgeType={currentGroup.user?.verification_badge_type}
                                    role={currentGroup.user?.role}
                                    size={13}
                                    className="translate-y-[1px]"
                                />
                            </p>
                            <p className="text-white/70 text-xs shrink-0">{timeAgo}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white text-2xl leading-none w-11 h-11 rounded-full bg-black/45 border border-white/15 active:scale-95 transition-transform"
                            aria-label="Close story"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div
                    className="absolute inset-0"
                    onMouseDown={handleHoldStart}
                    onMouseUp={() => handleHoldEnd()}
                    onMouseLeave={() => handleHoldEnd()}
                    onTouchStart={handleHoldStart}
                    onTouchEnd={() => handleHoldEnd()}
                    onTouchCancel={() => handleHoldEnd()}
                    onPointerDown={handleHoldStart}
                    onPointerUp={() => handleHoldEnd()}
                    onPointerCancel={() => handleHoldEnd()}
                >
                    {currentStory.media_type === "video" ? (
                        <video
                            ref={videoRef}
                            src={currentStory.media_url}
                            autoPlay
                            playsInline
                            muted
                            className="h-full w-full object-cover"
                            preload="metadata"
                        />
                    ) : (
                        <img src={currentStory.media_url} alt="story" className="h-full w-full object-cover" loading="eager" />
                    )}
                </div>

                <button
                    className="absolute left-0 top-0 h-full w-[50%] z-10"
                    onPointerDown={handleHoldStart}
                    onPointerUp={() => handleHoldEnd(goPrev)}
                    onPointerCancel={() => handleHoldEnd()}
                    onPointerLeave={() => handleHoldEnd()}
                    aria-label="Previous story"
                />
                <button
                    className="absolute right-0 top-0 h-full w-[50%] z-10"
                    onPointerDown={handleHoldStart}
                    onPointerUp={() => handleHoldEnd(goNext)}
                    onPointerCancel={() => handleHoldEnd()}
                    onPointerLeave={() => handleHoldEnd()}
                    aria-label="Next story"
                />

                <div
                    className="absolute left-0 right-0 bottom-0 z-20 p-4 bg-gradient-to-t from-black/85 to-transparent"
                    style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
                >
                    {currentStory.caption && (
                        <p className="text-white text-sm leading-relaxed mb-3 max-w-[96%] break-words bg-black/45 rounded-lg px-3 py-2 backdrop-blur-[1px]">
                            {currentStory.caption}
                        </p>
                    )}

                    {isOwnerStory && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowViewersPanel(true)}
                                className="rounded-full bg-black/45 border border-white/20 px-3 py-1.5 text-xs text-white"
                            >
                                Viewers ({currentStory.viewer_count || currentStory.viewers?.length || 0})
                            </button>

                            <button
                                type="button"
                                onClick={() => onAddStory?.()}
                                className="rounded-full bg-primary-500/90 px-3 py-1.5 text-xs text-white"
                            >
                                Add Story
                            </button>

                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setShowDeleteConfirm(true)}
                                className="rounded-full bg-red-500/90 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    )}
                </div>

                {isOwnerStory && showViewersPanel && (
                    <>
                        <div className="absolute inset-0 z-30 bg-black/50" onClick={() => setShowViewersPanel(false)} />

                        <div className="absolute z-40 left-0 right-0 bottom-0 md:left-auto md:right-4 md:bottom-4 md:top-20 md:w-[360px] bg-dark-2 border border-dark-4 rounded-t-2xl md:rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-light-1 text-sm font-semibold">
                                    Viewers ({currentStory.viewer_count || currentStory.viewers?.length || 0})
                                </p>
                                <button className="text-light-2 text-lg" onClick={() => setShowViewersPanel(false)}>×</button>
                            </div>

                            <div className="max-h-[45vh] md:max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                                {(currentStory.viewers || []).length === 0 ? (
                                    <p className="text-light-3 text-sm">No viewers yet</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {currentStory.viewers?.map((viewer) => (
                                            <li key={`${currentStory.id}-${viewer.id}`} className="flex items-center gap-3 rounded-xl bg-dark-3/70 border border-dark-4 px-3 py-2">
                                                <img
                                                    src={viewer.image_url || "/assets/icons/profile-placeholder.svg"}
                                                    alt={viewer.name}
                                                    className="w-9 h-9 rounded-full object-cover border border-dark-4"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1">
                                                      <p className="text-light-1 text-sm truncate uppercase font-bold">{viewer.name}</p>
                                                      <VerificationBadge
                                                          isVerified={viewer.is_verified}
                                                          badgeType={viewer.verification_badge_type}
                                                          role={viewer.role}
                                                          size={12}
                                                      />
                                                    </div>
                                                    <p className="text-light-3 text-xs truncate">@{viewer.username || "user"}</p>
                                                </div>
                                                <p className="text-light-4 text-[11px] shrink-0">{formatViewedAt(viewer.viewed_at)}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </>
                )}

                <ConfirmActionModal
                    isOpen={showDeleteConfirm}
                    title="Delete story"
                    description="Do you want to delete this story? This action cannot be undone."
                    confirmLabel="Yes"
                    cancelLabel="No"
                    isDestructive
                    isLoading={isDeleting}
                    onConfirm={handleConfirmDelete}
                    onClose={() => setShowDeleteConfirm(false)}
                />
            </div>
        </div>
    );
};

export default StoryViewer;
