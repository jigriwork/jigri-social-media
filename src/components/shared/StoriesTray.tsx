"use client";

import { useMemo, useState } from "react";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { StoryGroup } from "@/lib/supabase/api";
import { useGetStoriesFeed, useGetUserStories } from "@/lib/react-query/queriesAndMutations";
import { useStoryOpenController } from "@/context/StoryOpenContext";
import { useMutedStoryUsers } from "@/hooks/useMutedStoryUsers";
import CreateStoryModal from "./CreateStoryModal";
import VerificationBadge from "./VerificationBadge";

const ringClass = (isViewed: boolean) =>
    isViewed
        ? "bg-dark-4"
        : "bg-gradient-to-tr from-pink-500 via-orange-400 to-yellow-300";

const StoriesTray = () => {
    const { user } = useUserContext();
    const { openStoryForUser } = useStoryOpenController();
    const { isMuted } = useMutedStoryUsers();
    const { data: groups = [], isPending } = useGetStoriesFeed();
    const { data: ownStories = [] } = useGetUserStories(user?.id);

    const [createOpen, setCreateOpen] = useState(false);

    const orderedGroups = useMemo(() => {
        const visibleGroups = groups.filter((g: StoryGroup) => !isMuted(g?.user?.id || null));
        const mineFromFeed = visibleGroups.find((g: StoryGroup) => g.user?.id === user?.id);
        const others = visibleGroups.filter((g: StoryGroup) => g.user?.id !== user?.id);

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
    }, [groups, ownStories, user, isMuted]);

    const openGroup = async (index: number) => {
        const targetUserId = orderedGroups[index]?.user?.id;
        if (!targetUserId) return;
        await openStoryForUser(targetUserId, "feed");
    };

    const hasOwnStory = ownStories.length > 0 || orderedGroups.some((g: StoryGroup) => g.user?.id === user?.id);

    return (
        <>
            <div className="w-full max-w-[720px] mx-auto overflow-x-auto no-scrollbar px-1">
                <div className="flex items-center gap-4 py-1 min-w-max">
                    <div className="flex flex-col items-center pt-0.5 min-w-[76px]">
                        <button
                            onClick={() => {
                                if (hasOwnStory) {
                                    const mineIdx = orderedGroups.findIndex((g: StoryGroup) => g.user?.id === user?.id);
                                    if (mineIdx >= 0) void openGroup(mineIdx);
                                    else setCreateOpen(true);
                                } else {
                                    setCreateOpen(true);
                                }
                            }}
                            className="relative transition-transform duration-200 active:scale-95"
                        >
                            <div className={`relative p-[2.5px] rounded-full ${hasOwnStory ? ringClass(false) : "bg-dark-4"}`}>
                                <img
                                    src={user?.image_url || "/assets/icons/profile-placeholder.svg"}
                                    alt="your story"
                                    className="w-14 h-14 rounded-full object-cover border-2 border-black"
                                    loading="lazy"
                                />
                                {!hasOwnStory && (
                                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary-500 text-white text-sm flex items-center justify-center border-2 border-black shadow-lg">
                                        +
                                    </span>
                                )}
                            </div>
                        </button>
                        <div className="flex flex-col items-center mt-1.5 h-8 justify-start">
                            <span className="text-[11px] text-light-2 font-medium leading-tight">Your Story</span>
                            {hasOwnStory && (
                                <button
                                    type="button"
                                    onClick={() => setCreateOpen(true)}
                                    className="text-[9px] text-primary-400 hover:text-primary-300 font-bold leading-none mt-1"
                                    aria-label="Add another story"
                                >
                                    + Add
                                </button>
                            )}
                        </div>
                    </div>

                    {isPending
                        ? [...Array(5)].map((_, i) => (
                            <div key={i} className="w-14 h-14 rounded-full bg-dark-4 animate-pulse shrink-0" />
                        ))
                        : orderedGroups
                            .filter((group: StoryGroup) => group.user?.id !== user?.id)
                            .map((group: StoryGroup, idx: number) => {
                                const absoluteIdx = orderedGroups.findIndex((g: StoryGroup) => g.user?.id === group.user?.id);
                                return (
                                    <button
                                        key={group.user?.id || idx}
                                        onClick={() => void openGroup(absoluteIdx)}
                                        className="flex flex-col items-center pt-0.5 transition-transform duration-200 active:scale-95 min-w-[76px]"
                                    >
                                        <div className={`p-[2.5px] rounded-full ${ringClass(!group.hasUnviewed)}`}>
                                            <img
                                                src={group.user?.image_url || "/assets/icons/profile-placeholder.svg"}
                                                alt={group.user?.username || "story user"}
                                                className="w-14 h-14 rounded-full object-cover border-2 border-black"
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="mt-1.5 h-8 flex flex-col items-center justify-start">
                                            <span className="text-[11px] text-light-2 font-medium max-w-[72px] truncate inline-flex items-center gap-1 leading-tight">
                                                <span className="truncate">@{group.user?.username || "user"}</span>
                                                <VerificationBadge
                                                    isVerified={group.user?.is_verified}
                                                    badgeType={group.user?.verification_badge_type}
                                                    role={group.user?.role}
                                                    size={10}
                                                />
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                </div>
            </div>

            <CreateStoryModal open={createOpen} onClose={() => setCreateOpen(false)} />
        </>
    );
};

export default StoriesTray;
