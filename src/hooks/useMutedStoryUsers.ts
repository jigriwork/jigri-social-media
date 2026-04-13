"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MUTED_STORY_USERS_KEY = "jigri:stories:muted-users:v1";

export const useMutedStoryUsers = () => {
    const [mutedUserIds, setMutedUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(MUTED_STORY_USERS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setMutedUserIds(new Set(parsed.filter((id) => typeof id === "string")));
            }
        } catch {
            // ignore malformed storage
        }
    }, []);

    const persist = useCallback((next: Set<string>) => {
        setMutedUserIds(new Set(next));
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(MUTED_STORY_USERS_KEY, JSON.stringify(Array.from(next)));
        } catch {
            // non-critical
        }
    }, []);

    const muteUserStories = useCallback((userId: string) => {
        if (!userId) return;
        const next = new Set(mutedUserIds);
        next.add(userId);
        persist(next);
    }, [mutedUserIds, persist]);

    const unmuteUserStories = useCallback((userId: string) => {
        if (!userId) return;
        const next = new Set(mutedUserIds);
        next.delete(userId);
        persist(next);
    }, [mutedUserIds, persist]);

    const isMuted = useCallback((userId?: string | null) => {
        if (!userId) return false;
        return mutedUserIds.has(userId);
    }, [mutedUserIds]);

    const mutedIdsArray = useMemo(() => Array.from(mutedUserIds), [mutedUserIds]);

    return { mutedUserIds, mutedIdsArray, isMuted, muteUserStories, unmuteUserStories };
};
