"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Story, StoryGroup, getUserStories } from "@/lib/supabase/api";
import { useGetStoriesFeed } from "@/lib/react-query/queriesAndMutations";
import StoryViewer from "@/components/shared/StoryViewer";
import CreateStoryModal from "@/components/shared/CreateStoryModal";
import { useMutedStoryUsers } from "@/hooks/useMutedStoryUsers";

type StoryOpenSource = "feed" | "messages" | "post" | "profile";

type StoryOpenContextValue = {
    canOpenStories: boolean;
    openStoryForUser: (userId: string, source?: StoryOpenSource) => Promise<boolean>;
};

const StoryOpenContext = createContext<StoryOpenContextValue>({
    canOpenStories: false,
    openStoryForUser: async () => false,
});

const buildGroupFromStories = (stories: Story[], userId: string): StoryGroup | null => {
    if (!stories.length) return null;
    return {
        user: stories[0]?.users || {
            id: userId,
            username: stories[0]?.users?.username || "user",
            image_url: stories[0]?.users?.image_url || null,
            name: stories[0]?.users?.name || null,
            is_verified: stories[0]?.users?.is_verified || false,
            verification_badge_type: stories[0]?.users?.verification_badge_type || null,
            role: stories[0]?.users?.role || null,
        },
        stories,
        hasUnviewed: stories.some((story) => !story.viewed),
        latestCreatedAt: stories[stories.length - 1]?.created_at || new Date().toISOString(),
    };
};

export const StoryOpenProvider = ({ children }: { children: ReactNode }) => {
    const { data: feedGroups = [] } = useGetStoriesFeed();
    const { isMuted } = useMutedStoryUsers();

    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
    const [viewerGroups, setViewerGroups] = useState<StoryGroup[]>([]);
    const [createOpen, setCreateOpen] = useState(false);

    const baseGroups = useMemo(
        () => (feedGroups || []).filter((group: StoryGroup) => !isMuted(group?.user?.id || null)),
        [feedGroups, isMuted]
    );

    const openStoryForUser = useCallback(
        async (userId: string) => {
            if (!userId || isMuted(userId)) return false;

            const existingIndex = baseGroups.findIndex((group: StoryGroup) => group.user?.id === userId);
            if (existingIndex >= 0) {
                setViewerGroups(baseGroups);
                setViewerGroupIndex(existingIndex);
                setViewerOpen(true);
                return true;
            }

            try {
                const stories = await getUserStories(userId);
                if (!stories.length) return false;

                const newGroup = buildGroupFromStories(stories, userId);
                if (!newGroup) return false;

                const combined = [...baseGroups, newGroup];
                setViewerGroups(combined);
                setViewerGroupIndex(combined.length - 1);
                setViewerOpen(true);
                return true;
            } catch {
                return false;
            }
        },
        [baseGroups, isMuted]
    );

    const value = useMemo(
        () => ({
            canOpenStories: true,
            openStoryForUser,
        }),
        [openStoryForUser]
    );

    return (
        <StoryOpenContext.Provider value={value}>
            {children}
            <CreateStoryModal open={createOpen} onClose={() => setCreateOpen(false)} />
            <StoryViewer
                open={viewerOpen}
                groups={viewerGroups}
                initialGroupIndex={viewerGroupIndex}
                onAddStory={() => setCreateOpen(true)}
                onClose={() => setViewerOpen(false)}
            />
        </StoryOpenContext.Provider>
    );
};

export const useStoryOpenController = () => useContext(StoryOpenContext);
