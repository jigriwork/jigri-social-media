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

export default function PWARegistration() {
    useEffect(() => {
        if (typeof window === "undefined") return;

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

        const register = async () => {
            try {
                await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            } catch (error) {
                console.error("Service worker registration failed:", error);
            }
        };

        register();

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    return null;
}