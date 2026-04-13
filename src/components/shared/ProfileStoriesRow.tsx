"use client";

import { useMemo, useState } from "react";
import { useGetUserStories } from "@/lib/react-query/queriesAndMutations";
import { StoryGroup } from "@/lib/supabase/api";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { useStoryOpenController } from "@/context/StoryOpenContext";
import CreateStoryModal from "./CreateStoryModal";

type ProfileStoriesRowProps = {
    userId: string;
};

const ProfileStoriesRow = ({ userId }: ProfileStoriesRowProps) => {
    const { user } = useUserContext();
    const { openStoryForUser } = useStoryOpenController();
    const { data: stories = [] } = useGetUserStories(userId);
    const [createOpen, setCreateOpen] = useState(false);

    const isOwnProfile = user?.id === userId;

    const group: StoryGroup | null = useMemo(() => {
        if (!stories.length) return null;
        return {
            user: stories[0]?.users || {
                id: userId,
                username: stories[0]?.users?.username || user?.username || "user",
                image_url: stories[0]?.users?.image_url || user?.image_url || null,
            },
            stories,
            hasUnviewed: stories.some((s) => !s.viewed),
            latestCreatedAt: stories[stories.length - 1]?.created_at,
        };
    }, [stories, userId, user?.username, user?.image_url]);

    if (!group && !isOwnProfile) return null;

    return (
        <>
            <div className="w-full mt-3">
                <p className="text-light-2 text-sm font-semibold mb-2">Stories</p>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                    {isOwnProfile && (
                        <div className="flex flex-col items-center gap-1">
                            <button
                                onClick={() => {
                                    if (group) {
                                        void openStoryForUser(userId, "profile");
                                    } else {
                                        setCreateOpen(true);
                                    }
                                }}
                                className="relative"
                            >
                                <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-pink-500 via-orange-400 to-yellow-300">
                                    <img
                                        src={user?.image_url || "/assets/icons/profile-placeholder.svg"}
                                        alt="Your story"
                                        className="w-14 h-14 rounded-full object-cover border-2 border-black"
                                    />
                                    {!group && (
                                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center border border-black">
                                            +
                                        </span>
                                    )}
                                </div>
                            </button>
                            {group && (
                                <button
                                    type="button"
                                    onClick={() => setCreateOpen(true)}
                                    className="-mt-1 text-[10px] text-primary-400 hover:text-primary-300"
                                >
                                    + Add
                                </button>
                            )}
                            <span className="text-[11px] text-light-2">Your Story</span>
                        </div>
                    )}

                    {!!group && !isOwnProfile && (
                        <button onClick={() => void openStoryForUser(userId, "profile")} className="flex flex-col items-center gap-1">
                            <div className={`p-[2px] rounded-full ${group.hasUnviewed ? "bg-gradient-to-tr from-pink-500 via-orange-400 to-yellow-300" : "bg-dark-4"}`}>
                                <img
                                    src={group.user?.image_url || "/assets/icons/profile-placeholder.svg"}
                                    alt="Profile stories"
                                    className="w-12 h-12 rounded-full object-cover border-2 border-black"
                                />
                            </div>
                            <span className="text-[10px] text-light-4">{group.stories.length} stories</span>
                        </button>
                    )}
                </div>
            </div>

            <CreateStoryModal open={createOpen} onClose={() => setCreateOpen(false)} />
        </>
    );
};

export default ProfileStoriesRow;
