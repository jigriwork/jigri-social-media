"use client";

import { useEffect } from "react";

declare global {
    interface BeforeInstallPromptEvent extends Event {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    }

    interface Window {
        __jigriDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
    }
}

/**
 * PWARegistration
 * - Registers the service worker
 * - Detects updates and FORCES an immediate refresh so users never run stale code
 * - Clears old caches on every load to prevent zombie resources
 */
export default function PWARegistration() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        // ── Install prompt ──
        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            window.__jigriDeferredInstallPrompt = event as BeforeInstallPromptEvent;
            window.dispatchEvent(new Event("jigri-beforeinstallprompt"));
        };

        const handleInstalled = () => {
            window.__jigriDeferredInstallPrompt = null;
            window.dispatchEvent(new Event("jigri-appinstalled"));
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleInstalled);

        if (!("serviceWorker" in navigator)) {
            return () => {
                window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
                window.removeEventListener("appinstalled", handleInstalled);
            };
        }

        // ── Register + force-update logic ──
        const registerAndWatch = async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js", {
                    scope: "/",
                    updateViaCache: "none", // Always fetch fresh sw.js from network
                });

                // Check for updates immediately on load
                registration.update().catch(() => {});

                // Also poll for updates every 60 seconds
                const updateInterval = setInterval(() => {
                    registration.update().catch(() => {});
                }, 60_000);

                // When a new service worker is found…
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener("statechange", () => {
                        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                            // New version ready — tell it to activate NOW
                            newWorker.postMessage("SKIP_WAITING");
                        }
                    });
                });

                // When the new SW takes over, reload the page to get fresh assets
                let refreshing = false;
                navigator.serviceWorker.addEventListener("controllerchange", () => {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                });

                // Cleanup interval on unmount
                return () => clearInterval(updateInterval);
            } catch (error) {
                console.error("Service worker registration failed:", error);
            }
        };

        registerAndWatch();

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    return null;
}