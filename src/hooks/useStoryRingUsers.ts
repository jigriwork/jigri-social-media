"use client";

import { useMemo } from "react";
import { useGetStoriesFeed } from "@/lib/react-query/queriesAndMutations";
import { useMutedStoryUsers } from "./useMutedStoryUsers";

export const useStoryRingUsers = () => {
    const { data: groups = [] } = useGetStoriesFeed();
    const { isMuted } = useMutedStoryUsers();

    const usersWithStories = useMemo(() => {
        const ids = new Set<string>();
        groups.forEach((group: any) => {
            if (group?.user?.id && Array.isArray(group?.stories) && group.stories.length > 0) {
                if (isMuted(group.user.id)) return;
                ids.add(group.user.id);
            }
        });
        return ids;
    }, [groups, isMuted]);

    const hasActiveStory = (userId?: string | null) => {
        if (!userId) return false;
        return usersWithStories.has(userId);
    };

    return { hasActiveStory };
};
