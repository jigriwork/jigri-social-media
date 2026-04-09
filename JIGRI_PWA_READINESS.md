# Jigri PWA / App Readiness Audit

Date: 2026-04-09

---

## Executive result

**Current PWA readiness: NOT PWA-ready yet.**

The app behaves like a responsive web app, but key PWA building blocks (manifest + service worker + install flow) are absent.

---

## 1) Manifest

- Checked for manifest references and files -> **not found**.
- No `manifest.json` in `public/`.
- No `<link rel="manifest">` setup found.

Status: **Missing**

---

## 2) Service worker

- No service worker registration (`navigator.serviceWorker.register`) found.
- No SW script/workbox/next-pwa integration found.

Status: **Missing**

---

## 3) Installability status

Since manifest + service worker are missing, install criteria for modern browsers are not met.

Status: **Not installable as PWA**

---

## 4) Offline behavior

- No explicit offline app shell or offline route.
- React Query uses `networkMode: 'offlineFirst'`, which can reuse cached query data in some cases.
- This is **not** equivalent to full offline app support.

Status: **Minimal cache resilience only**

---

## 5) Caching strategy

Current effective caching:
- React Query stale/cache settings.
- Browser default caching for static assets.

Missing for production PWA:
- SW-controlled runtime caching policies.
- App shell precache.
- Offline fallbacks for route/image/data failures.

Status: **Partial (non-PWA cache strategy)**

---

## 6) Mobile home-screen install readiness

- No manifest/icons/splash definition means poor/absent install metadata.
- No explicit beforeinstallprompt UX.

Status: **Not ready**

---

## 7) App icons / splash readiness

- Assets exist under `public/assets`, but no manifest mapping for icon sizes/purpose/maskable icons.
- No splash screen definitions through manifest metadata.

Status: **Asset availability partial, PWA wiring missing**

---

## 8) Responsive/mobile behavior quality

- Strong responsive navigation model exists (Topbar + LeftSidebar + Bottombar).
- Auth screens and main feed are mobile-friendly.

Status: **Good responsive web quality**

---

## 9) Website vs downloadable-app feel

Current feel:
- **Good mobile web app feel**
- **Not a downloadable/installable app experience yet**

---

## 10) What is required for production-grade PWA

Minimum required:
1. Add web app manifest with full icon matrix (including maskable icons).
2. Add service worker (manual/workbox/Next-compatible plugin) with explicit caching strategy:
   - App shell precache
   - Runtime caching for API/image/static with TTL controls
3. Add install prompt UX and install state handling.
4. Add offline fallback pages and no-network UI states.
5. Validate Lighthouse PWA criteria and fix issues.
6. Define update strategy for SW versioning and cache invalidation.

Recommended after minimum:
- Background sync for queued social actions (optional).
- Push notification strategy (if desired and compliant with product goals).
