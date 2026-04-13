"use client";

import { useState, useEffect, useCallback } from "react";

const ONBOARDING_KEY = "jigri_onboarding_seen";

/**
 * Hook to manage first-time cinematic onboarding state.
 * Returns whether the onboarding should show, and a function to dismiss it.
 * The flag is persisted in localStorage so the experience only runs once.
 */
export function useFirstTimeOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setChecked(true);
      return;
    }

    try {
      const seen = localStorage.getItem(ONBOARDING_KEY);
      setShouldShow(seen !== "true");
    } catch {
      // If localStorage is unavailable, skip onboarding gracefully
      setShouldShow(false);
    }
    setChecked(true);
  }, []);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
      // Silently fail — non-critical
    }
  }, []);

  return { shouldShow, dismiss, checked };
}
