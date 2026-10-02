import { NavLink } from "react-router";

/**
 * Reusable, illustrative empty-state used across the app so every list/section
 * guides the user instead of showing a blank area.
 *
 * Props:
 *  - icon: a react-icons component (rendered inside a soft badge)
 *  - title: short headline
 *  - description: one/two line explainer
 *  - primaryTo / primaryLabel / onPrimary: primary CTA (NavLink when `primaryTo`, else button)
 *  - secondaryTo / secondaryLabel / onSecondary: optional secondary CTA
 *  - compact: tighter vertical padding for inner cards
 *  - tone: "brand" (default) | "neutral" badge colouring
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  primaryTo,
  primaryLabel,
  onPrimary,
  secondaryTo,
  secondaryLabel,
  onSecondary,
  className = "",
  compact = false,
  tone = "brand",
}) {
  const badgeGlow =
    tone === "neutral"
      ? "from-gray-200 to-gray-300 dark:from-white/10 dark:to-white/5"
      : "from-brand-200 to-brand-400 dark:from-brand/25 dark:to-brand/10";
  const iconColor =
    tone === "neutral"
      ? "text-ink-soft dark:text-gray-300"
      : "text-brand-600 dark:text-brand-400";

  return (
    <div
      className={`relative isolate flex flex-col items-center justify-center overflow-hidden text-center ${compact ? "py-10" : "py-16"} px-6 nw-rise ${className}`}
      data-testid="empty-state"
    >
      {/* Ambient illustration: soft glow + a few gently pulsing colour orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-4 h-52 w-52 -translate-x-1/2 rounded-full bg-brand-300/25 blur-3xl dark:bg-brand/15" />
        <span className="absolute left-[18%] top-10 h-2.5 w-2.5 rounded-full bg-brand-400/60 blur-[1px] animate-pulse" style={{ animationDuration: "3.5s" }} />
        <span className="absolute right-[20%] top-16 h-2 w-2 rounded-full bg-fuchsia-400/60 blur-[1px] animate-pulse" style={{ animationDuration: "4.2s", animationDelay: "0.4s" }} />
        <span className="absolute left-[30%] bottom-12 h-1.5 w-1.5 rounded-full bg-amber-400/70 blur-[1px] animate-pulse" style={{ animationDuration: "5s", animationDelay: "0.8s" }} />
        <span className="absolute right-[26%] bottom-16 h-2 w-2 rounded-full bg-brand-300/60 blur-[1px] animate-pulse" style={{ animationDuration: "4.6s", animationDelay: "0.2s" }} />
      </div>

      <div className="relative mb-6 nw-floaty">
        <div
          className={`absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-tr ${badgeGlow} opacity-70 blur-2xl`}
          aria-hidden="true"
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.6rem] border border-line bg-white shadow-[0_18px_40px_-20px_rgba(8,145,178,0.5)] dark:border-white/[0.1] dark:bg-gray-900 dark:shadow-[0_24px_60px_-24px_rgba(34,230,255,0.7)]">
          <div className="absolute inset-[3px] rounded-[1.35rem] bg-gradient-to-br from-brand-50 to-white dark:from-white/[0.06] dark:to-transparent" aria-hidden="true" />
          {Icon ? <Icon className={`relative h-10 w-10 ${iconColor}`} aria-hidden="true" /> : null}
        </div>
      </div>

      <h3 className="text-xl font-bold tracking-tight text-primary dark:text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-15 text-ink-soft dark:text-gray-400">{description}</p>
      ) : null}

      {(primaryLabel || secondaryLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {primaryLabel &&
            (primaryTo ? (
              <NavLink to={primaryTo} className="nw-btn-primary" data-testid="empty-primary-cta">
                {primaryLabel}
              </NavLink>
            ) : (
              <button type="button" onClick={onPrimary} className="nw-btn-primary" data-testid="empty-primary-cta">
                {primaryLabel}
              </button>
            ))}
          {secondaryLabel &&
            (secondaryTo ? (
              <NavLink to={secondaryTo} className="nw-btn-secondary">
                {secondaryLabel}
              </NavLink>
            ) : (
              <button type="button" onClick={onSecondary} className="nw-btn-secondary">
                {secondaryLabel}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
