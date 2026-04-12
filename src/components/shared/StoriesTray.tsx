"use client";

import { useMemo, useState } from "react";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { StoryGroup } from "@/lib/supabase/api";
import { useGetStoriesFeed, useGetUserStories } from "@/lib/react-query/queriesAndMutations";
import CreateStoryModal from "./CreateStoryModal";
import StoryViewer from "./StoryViewer";
import VerificationBadge from "./VerificationBadge";

const ringClass = (isViewed: boolean) =>
    isViewed
        ? "bg-dark-4"
        : "bg-gradient-to-tr from-pink-500 via-orange-400 to-yellow-300";

const StoriesTray = () => {
    const { user } = useUserContext();
    const { data: groups = [], isPending } = useGetStoriesFeed();
    const { data: ownStories = [] } = useGetUserStories(user?.id);

    const [createOpen, setCreateOpen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerGroupIndex, setViewerGroupIndex] = useState(0);

    const orderedGroups = useMemo(() => {
        const mineFromFeed = groups.find((g: StoryGroup) => g.user?.id === user?.id);
        const others = groups.filter((g: StoryGroup) => g.user?.id !== user?.id);

        if (!user?.id) return others;

        if (ownStories.length > 0) {
            const ownGroup: StoryGroup = {
                user: mineFromFeed?.user || {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    image_url: user.image_url,
                    is_verified: user.is_verified,
                    verification_badge_type: user.verification_badge_type,
                    role: user.role,
                },
                stories: ownStories,
                hasUnviewed: ownStories.some((story) => !story.viewed),
                latestCreatedAt: ownStories[ownStories.length - 1]?.created_at || new Date().toISOString(),
            };

            return [ownGroup, ...others];
        }

        return mineFromFeed ? [mineFromFeed, ...others] : others;
    }, [groups, ownStories, user]);

    const openGroup = (index: number) => {
        setViewerGroupIndex(index);
        setViewerOpen(true);
    };

    const hasOwnStory = ownStories.length > 0 || orderedGroups.some((g: StoryGroup) => g.user?.id === user?.id);

    return (
        <>
            <div className="w-full max-w-[720px] overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 py-2 min-w-max">
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={() => {
                                if (hasOwnStory) {
                                    const mineIdx = orderedGroups.findIndex((g: StoryGroup) => g.user?.id === user?.id);
                                    if (mineIdx >= 0) openGroup(mineIdx);
                                    else setCreateOpen(true);
                                } else {
                                    setCreateOpen(true);
                                }
                            }}
                            className="relative"
                        >
                            <div className={`relative p-[2px] rounded-full ${hasOwnStory ? ringClass(false) : "bg-dark-4"}`}>
                                <img
                                    src={user?.image_url || "/assets/icons/profile-placeholder.svg"}
                                    alt="your story"
                                    className="w-14 h-14 rounded-full object-cover border-2 border-black"
                                    loading="lazy"
                                />
                                {!hasOwnStory && (
                                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center border border-black">
                                        +
                                    </span>
                                )}
                            </div>
                        </button>
                        {hasOwnStory && (
                            <button
                                type="button"
                                onClick={() => setCreateOpen(true)}
                                className="-mt-1 text-[10px] text-primary-400 hover:text-primary-300"
                                aria-label="Add another story"
                            >
                                + Add
                            </button>
                        )}
                        <span className="text-[11px] text-light-2">Your Story</span>
                    </div>

                    {isPending
                        ? [...Array(5)].map((_, i) => (
                            <div key={i} className="w-14 h-14 rounded-full bg-dark-4 animate-pulse" />
                        ))
                        : orderedGroups
                            .filter((group: StoryGroup) => group.user?.id !== user?.id)
                            .map((group: StoryGroup, idx: number) => {
                                const absoluteIdx = orderedGroups.findIndex((g: StoryGroup) => g.user?.id === group.user?.id);
                                return (
                                    <button key={group.user?.id || idx} onClick={() => openGroup(absoluteIdx)} className="flex flex-col items-center gap-1">
                                        <div className={`p-[2px] rounded-full ${ringClass(!group.hasUnviewed)}`}>
                                            <img
                                                src={group.user?.image_url || "/assets/icons/profile-placeholder.svg"}
                                                alt={group.user?.username || "story user"}
                                                className="w-14 h-14 rounded-full object-cover border-2 border-black"
                                                loading="lazy"
                                            />
                                        </div>
                                        <span className="text-[11px] text-light-2 max-w-[70px] truncate inline-flex items-center gap-1">
                                            <span className="truncate">@{group.user?.username || "user"}</span>
                                            <VerificationBadge
                                                isVerified={group.user?.is_verified}
                                                badgeType={group.user?.verification_badge_type}
                                                role={group.user?.role}
                                                size={11}
                                            />
                                        </span>
                                    </button>
                                );
                            })}
                </div>
            </div>

            <CreateStoryModal open={createOpen} onClose={() => setCreateOpen(false)} />

            <StoryViewer
                open={viewerOpen}
                groups={orderedGroups}
                initialGroupIndex={viewerGroupIndex}
                onAddStory={() => setCreateOpen(true)}
                onClose={() => setViewerOpen(false)}
            />
        </>
    );
};

export default StoriesTray;
