"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

declare global {
    interface BeforeInstallPromptEvent extends Event {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    }

    interface Navigator {
        standalone?: boolean;
    }

    interface Window {
        __jigriDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
    }
}

type PWAInstallPromptProps = {
    variant?: "auth" | "settings" | "inline";
    className?: string;
    compact?: boolean;
    buttonLabel?: string;
    descriptionOverride?: string;
};

const isStandaloneMode = () => {
    if (typeof window === "undefined") return false;

    return (
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
        navigator.standalone === true
    );
};

const isiOS = () => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
};

export default function PWAInstallPrompt({
    variant = "auth",
    className = "",
    compact = false,
    buttonLabel,
    descriptionOverride,
}: PWAInstallPromptProps) {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showIOSHelp, setShowIOSHelp] = useState(false);
    const [showDesktopHelp, setShowDesktopHelp] = useState(false);

    useEffect(() => {
        setIsInstalled(isStandaloneMode());
        setDeferredPrompt(window.__jigriDeferredInstallPrompt ?? null);

        const handleDeferredReady = () => {
            setDeferredPrompt(window.__jigriDeferredInstallPrompt ?? null);
            setShowDesktopHelp(false);
        };

        const handleInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setShowIOSHelp(false);
            setShowDesktopHelp(false);
        };

        window.addEventListener("jigri-beforeinstallprompt", handleDeferredReady);
        window.addEventListener("jigri-appinstalled", handleInstalled);
        window.addEventListener("appinstalled", handleInstalled);

        return () => {
            window.removeEventListener("jigri-beforeinstallprompt", handleDeferredReady);
            window.removeEventListener("jigri-appinstalled", handleInstalled);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    const handleInstall = useCallback(async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setDeferredPrompt(null);
            return;
        }

        if (isiOS()) {
            setShowIOSHelp((prev) => !prev);
            setShowDesktopHelp(false);
            return;
        }

        setShowDesktopHelp((prev) => !prev);
    }, [deferredPrompt]);

    const content = useMemo(() => {
        if (isInstalled) {
            return {
                badge: "Installed",
                title: "Jigri is ready on your device",
                description: "You’re already using the app-style experience with faster access from your home screen or desktop.",
                button: "App installed",
            };
        }

        return {
            badge: "Best experience",
            title:
                variant === "settings"
                    ? "Install Jigri on this device"
                    : variant === "inline"
                        ? "Best on app"
                        : "Get the full app experience",
            description:
                descriptionOverride || (variant === "settings"
                    ? "Pin Jigri to your desktop or home screen for faster access, cleaner navigation, and a more native experience."
                    : variant === "inline"
                        ? "Download Jigri for the cleanest experience on mobile and desktop."
                        : "Install Jigri for quicker launch, immersive full-screen browsing, and a smoother social experience on mobile and desktop."),
            button: buttonLabel || (deferredPrompt ? "Download" : isiOS() ? "How to install" : "Install info"),
        };
    }, [deferredPrompt, isInstalled, variant]);

    if (isInstalled && compact) {
        return null;
    }

    if (variant === "inline") {
        return (
            <section className={`rounded-2xl border border-dark-4/40 bg-dark-3/30 px-4 py-3 ${className}`.trim()}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-light-1">{content.title}</p>
                        <p className="mt-1 text-xs leading-5 text-light-3">{content.description}</p>
                    </div>
                    <Button
                        type="button"
                        onClick={handleInstall}
                        disabled={isInstalled}
                        className="w-full sm:w-auto rounded-xl bg-primary-500 px-4 py-2.5 text-white hover:bg-primary-600"
                    >
                        {content.button}
                    </Button>
                </div>

                {showIOSHelp && !isInstalled && (
                    <p className="mt-3 text-xs leading-5 text-light-4">
                        On iPhone or iPad, open Jigri in Safari, tap Share, then choose Add to Home Screen.
                    </p>
                )}

                {showDesktopHelp && !isInstalled && !isiOS() && (
                    <p className="mt-3 text-xs leading-5 text-light-4">
                        Install prompt isn&apos;t available yet. Open Jigri in Chrome/Edge over HTTPS,
                        use the browser menu (⋮) and choose <span className="text-light-2 font-medium">Install app</span>.
                    </p>
                )}
            </section>
        );
    }

    const wrapperClass =
        variant === "settings"
            ? "rounded-2xl border border-dark-4/40 bg-dark-2 p-6"
            : "rounded-[28px] border border-primary-500/20 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.22),_rgba(17,17,20,0.96)_55%)] p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]";

    return (
        <section className={`${wrapperClass} ${className}`.trim()}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="inline-flex w-fit items-center rounded-full border border-primary-500/25 bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-300">
                        {content.badge}
                    </span>
                    <div className="flex items-center gap-2 text-light-3 text-xs sm:text-sm">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        Mobile + desktop install supported
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-xl">
                        <h3 className="text-xl sm:text-2xl font-semibold text-light-1">{content.title}</h3>
                        <p className="mt-2 text-sm sm:text-[15px] leading-6 text-light-3">{content.description}</p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-3 min-w-[180px]">
                        <Button
                            type="button"
                            onClick={handleInstall}
                            disabled={isInstalled}
                            className="w-full sm:w-auto rounded-xl bg-primary-500 px-5 py-3 text-white hover:bg-primary-600"
                        >
                            {content.button}
                        </Button>
                        {!isInstalled && (
                            <p className="text-xs text-light-4 sm:text-right">
                                Install once and launch Jigri like a native app.
                            </p>
                        )}
                    </div>
                </div>

                {showIOSHelp && !isInstalled && (
                    <div className="rounded-2xl border border-dark-4/50 bg-dark-3/70 p-4 text-sm text-light-2">
                        <p className="font-medium text-light-1">Install on iPhone or iPad</p>
                        <p className="mt-2 leading-6 text-light-3">
                            Open Jigri in Safari, tap the <span className="font-semibold text-light-1">Share</span> button, then choose <span className="font-semibold text-light-1">Add to Home Screen</span>.
                        </p>
                    </div>
                )}

                {showDesktopHelp && !isInstalled && !isiOS() && (
                    <div className="rounded-2xl border border-dark-4/50 bg-dark-3/70 p-4 text-sm text-light-2">
                        <p className="font-medium text-light-1">Install on Android/Desktop</p>
                        <p className="mt-2 leading-6 text-light-3">
                            If the one-tap prompt doesn&apos;t appear yet, open this app in Chrome or Edge and use browser menu
                            <span className="font-semibold text-light-1"> Install app</span>. This usually appears after you browse the app for a short time on HTTPS.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}