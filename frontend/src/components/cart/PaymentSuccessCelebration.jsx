import { useMemo } from "react";

// Brand-aligned confetti palette (indigo, emerald, amber, pink, cyan, violet).
const COLORS = ["#22E6FF", "#22c55e", "#f59e0b", "#FF3DCB", "#0891B2", "#7C5CFF"];

/**
 * ConfettiBurst
 * A dependency-free, one-shot confetti layer. Render it inside a positioned
 * parent (e.g. `absolute inset-0`) or as a fixed full-screen overlay. It is
 * purely decorative and non-interactive. Honours prefers-reduced-motion
 * (handled in index.css — the pieces are hidden).
 */
export function ConfettiBurst({ pieces = 20, className = "" }) {
  const confetti = useMemo(
    () =>
      Array.from({ length: pieces }).map((_, i) => {
        const left = Math.min(96, Math.max(2, Math.round((i / pieces) * 100 + (Math.random() * 10 - 5))));
        const delay = (Math.random() * 0.25).toFixed(2);
        const duration = (1.1 + Math.random() * 0.9).toFixed(2);
        const color = COLORS[i % COLORS.length];
        const size = 6 + Math.round(Math.random() * 6);
        const rotate = 180 + Math.round(Math.random() * 360);
        const drift = Math.round(Math.random() * 120 - 60);
        return { id: i, left, delay, duration, color, size, rotate, drift };
      }),
    [pieces]
  );

  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      {confetti.map((c) => (
        <span
          key={c.id}
          className="nw-confetti-piece"
          style={{
            left: `${c.left}%`,
            width: `${c.size}px`,
            height: `${c.size}px`,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            "--nw-drift": `${c.drift}px`,
            "--nw-rot": `${c.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * PaymentSuccessCelebration
 * A self-contained "paid!" celebration: an animated checkmark badge with an
 * expanding ring and a short confetti burst. Purely presentational — the caller
 * decides when to render it and when to auto-close/navigate.
 */
export default function PaymentSuccessCelebration({
  title = "Payment confirmed!",
  subtitle = "",
  amountLabel = null,
  pieces = 20,
  testId = "payment-success-celebration",
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center py-10 text-center"
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      {/* Confetti burst layer */}
      <ConfettiBurst pieces={pieces} className="absolute inset-0" />

      {/* Animated checkmark badge */}
      <div className="nw-cele-circle relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
        <span className="nw-cele-ring absolute inset-0 rounded-full border-2 border-emerald-400" aria-hidden="true" />
        <svg viewBox="0 0 52 52" className="h-11 w-11" aria-hidden="true">
          <path
            className="nw-cele-check-path"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 27 l8 8 l16 -18"
          />
        </svg>
      </div>

      <p className="nw-cele-text mt-5 text-xl font-bold text-primary dark:text-white">{title}</p>
      {amountLabel && (
        <p
          className="nw-cele-text mt-1 font-mono text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400"
          style={{ animationDelay: "0.42s" }}
          data-testid="payment-success-amount"
        >
          {amountLabel}
        </p>
      )}
      {subtitle && (
        <p className="nw-cele-text mt-1.5 max-w-xs text-sm text-ink-soft dark:text-gray-400" style={{ animationDelay: "0.46s" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
