"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUserContext } from "@/context/SupabaseAuthContext";

/* ──────────────────────────────────────────────────────────
   CSS-only animation keyframes injected once into <head>.
   No external animation libs required.
   ────────────────────────────────────────────────────────── */
const STYLES = `
/* ── base ── */
.cin-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

/* ── particles ── */
.cin-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: rgba(139, 92, 246, 0.25);
  border-radius: 50%;
  animation: cin-float linear infinite;
  pointer-events: none;
}

@keyframes cin-float {
  0%   { transform: translateY(0) scale(1);   opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(-100vh) scale(0.4); opacity: 0; }
}

/* ── center pulse ── */
.cin-pulse {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%);
  animation: cin-pulse-anim 2.4s ease-out forwards;
  pointer-events: none;
}

@keyframes cin-pulse-anim {
  0%   { transform: scale(0.3); opacity: 0; }
  30%  { transform: scale(1);   opacity: 1; }
  60%  { transform: scale(1.6); opacity: 0.5; }
  100% { transform: scale(2.4); opacity: 0; }
}

/* ── text blocks ── */
.cin-text {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 0 24px;
}

.cin-hero {
  font-size: clamp(28px, 7vw, 52px);
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.02em;
  line-height: 1.15;
  opacity: 0;
  transform: scale(0.92);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.cin-hero.visible {
  opacity: 1;
  transform: scale(1);
}

.cin-sub {
  font-size: clamp(14px, 3.5vw, 18px);
  font-weight: 400;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.04em;
  margin-top: 12px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s;
}
.cin-sub.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── community block ── */
.cin-community {
  position: relative;
  z-index: 2;
  width: calc(100% - 48px);
  max-width: 380px;
  margin: 24px auto 0;
  padding: 18px 20px;
  border-radius: 20px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(139,92,246,0.12);
  text-align: center;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.cin-community.visible {
  opacity: 1;
  transform: translateY(0);
}

.cin-community p {
  font-size: 13px;
  line-height: 1.7;
  color: rgba(255,255,255,0.45);
  margin: 0;
}
.cin-community p + p {
  margin-top: 4px;
}

.cin-mii {
  display: inline-block;
  margin-top: 14px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(139,92,246,0.1);
  border: 1px solid rgba(139,92,246,0.2);
  font-size: 14px;
  letter-spacing: 0.02em;
  color: rgba(255,255,255,0.8);
}

/* ── tap ripple ── */
.cin-ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.15);
  transform: scale(0);
  animation: cin-ripple-anim 0.6s ease-out forwards;
  pointer-events: none;
  z-index: 3;
}

@keyframes cin-ripple-anim {
  0%   { transform: scale(0); opacity: 0.6; }
  100% { transform: scale(4); opacity: 0; }
}

/* ── exit transition ── */
.cin-root.cin-exit {
  animation: cin-fade-out 0.5s ease forwards;
}

@keyframes cin-fade-out {
  0%   { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
`;

/* ──────────────────────────────────────────────────────────
   Particle helper – generates positions for floating dots
   ────────────────────────────────────────────────────────── */
function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    animationDuration: `${5 + Math.random() * 8}s`,
    animationDelay: `${Math.random() * 4}s`,
    size: `${2 + Math.random() * 2}px`,
    opacity: 0.15 + Math.random() * 0.2,
  }));
}

const PARTICLES = generateParticles(18);

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */
type CinematicEntryProps = {
  onComplete: () => void;
};

export default function CinematicEntry({ onComplete }: CinematicEntryProps) {
  const { user } = useUserContext();
  const [phase, setPhase] = useState(0); // 0=entry, 1=identity, 2=community, 3=exiting
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = useRef(0);
  const timerRefs = useRef<NodeJS.Timeout[]>([]);
  const hasAccelerated = useRef(false);

  const username = user?.username || user?.name || "friend";

  // Inject styles once
  useEffect(() => {
    const existing = document.getElementById("cin-styles");
    if (!existing) {
      const style = document.createElement("style");
      style.id = "cin-styles";
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
    return () => {
      // Cleanup styles on unmount
      document.getElementById("cin-styles")?.remove();
    };
  }, []);

  // Phase timeline
  useEffect(() => {
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timerRefs.current.push(t);
      return t;
    };

    // Phase 0 → 1 (entry → identity): 800ms
    schedule(() => setPhase(1), 800);

    // Phase 1 → 2 (identity → community): 1600ms
    schedule(() => setPhase(2), 1800);

    // Phase 2 → 3 (community → exit): 4200ms (allows reading)
    schedule(() => setPhase(3), 4800);

    // Complete after exit animation
    schedule(() => onComplete(), 5300);

    return () => {
      timerRefs.current.forEach(clearTimeout);
    };
  }, [onComplete]);

  // Tap to accelerate
  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Create ripple
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const id = rippleId.current++;
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);

      // Accelerate: skip to exit on second+ tap
      if (!hasAccelerated.current && phase >= 1) {
        hasAccelerated.current = true;
        timerRefs.current.forEach(clearTimeout);
        timerRefs.current = [];

        // Show community briefly then exit
        if (phase < 2) {
          setPhase(2);
          setTimeout(() => setPhase(3), 800);
          setTimeout(() => onComplete(), 1300);
        } else {
          setPhase(3);
          setTimeout(() => onComplete(), 500);
        }
      }
    },
    [phase, onComplete]
  );

  return (
    <div
      className={`cin-root ${phase === 3 ? "cin-exit" : ""}`}
      onClick={handleTap}
      onTouchStart={handleTap}
      role="presentation"
    >
      {/* Particles */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="cin-particle"
          style={{
            left: p.left,
            bottom: "-10px",
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: p.animationDuration,
            animationDelay: p.animationDelay,
          }}
        />
      ))}

      {/* Center pulse */}
      <div className="cin-pulse" />

      {/* Text content */}
      <div className="cin-text">
        {/* Phase 0: "You're in." */}
        {phase === 0 && (
          <h1 className={`cin-hero ${phase >= 0 ? "visible" : ""}`}>
            You&apos;re in.
          </h1>
        )}

        {/* Phase 1+: Welcome + username */}
        {phase >= 1 && phase < 3 && (
          <>
            <h1 className={`cin-hero ${phase >= 1 ? "visible" : ""}`}>
              Welcome to Jigri
            </h1>
            <p className={`cin-sub ${phase >= 1 ? "visible" : ""}`}>
              @{username} is live.
            </p>
          </>
        )}
      </div>

      {/* Phase 2+: Community announcement */}
      {phase >= 2 && phase < 3 && (
        <div className={`cin-community ${phase >= 2 ? "visible" : ""}`}>
          <p>We just launched Jigri v1.</p>
          <p>We&apos;re actively fixing bugs and improving every day.</p>
          <p style={{ marginTop: 8, color: "rgba(255,255,255,0.55)" }}>
            Help us build this together.
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)" }}>
            Report issues. Share feedback. Be part of the journey.
          </p>
          <span className="cin-mii">Made in India ❤️</span>
        </div>
      )}

      {/* Tap ripples */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="cin-ripple"
          style={{
            left: r.x - 30,
            top: r.y - 30,
            width: 60,
            height: 60,
          }}
        />
      ))}
    </div>
  );
}
