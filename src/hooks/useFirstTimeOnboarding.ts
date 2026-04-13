"use client";

import { useState, useEffect, useCallback } from "react";

const ONBOARDING_KEY_PREFIX = "jigri:onboarding:cinematic:v2";

const getOnboardingKey = (userId?: string) => `${ONBOARDING_KEY_PREFIX}:${userId || "anonymous"}`;

/**
 * Hook to manage first-time cinematic onboarding state.
 * Returns whether the onboarding should show, and a function to dismiss it.
 * The flag is persisted in localStorage so the experience only runs once.
 */
export function useFirstTimeOnboarding(userId?: string) {
  const [shouldShow, setShouldShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setChecked(true);
      return;
    }

    if (!userId) {
      setShouldShow(false);
      setChecked(true);
      return;
    }

    try {
      const seen = localStorage.getItem(getOnboardingKey(userId));
      setShouldShow(seen !== "true");
    } catch {
      // If localStorage is unavailable, skip onboarding gracefully
      setShouldShow(false);
    }
    setChecked(true);
  }, [userId]);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    if (!userId) return;
    try {
      localStorage.setItem(getOnboardingKey(userId), "true");
    } catch {
      // Silently fail — non-critical
    }
  }, [userId]);

  return { shouldShow, dismiss, checked };
}
