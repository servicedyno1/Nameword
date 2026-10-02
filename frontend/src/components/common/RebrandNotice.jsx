import { useState } from "react";
import { LuX } from "react-icons/lu";
import { useLanguage } from "../../hooks/useLanguage";
import { HostaMark } from "./BrandLogo";

// One-time "Nameword is now hosta.sh" notice for existing customers inside the
// signed-in app. Dismissal is remembered on this device (shared with the landing bar).
export const REBRAND_NOTICE_KEY = "hs_rebrand_notice_dismissed_v1";

export default function RebrandNotice() {
  const { t } = useLanguage();
  const r = t?.site?.rebrand || {};
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(REBRAND_NOTICE_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden || !r.textApp) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(REBRAND_NOTICE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div
      className="flex items-center gap-3 border-b border-brand-200/70 bg-brand-50/80 px-4 py-2.5 text-ink dark:border-brand/20 dark:bg-brand/[0.06] lg:px-6"
      role="status"
      data-testid="rebrand-notice"
    >
      <HostaMark className="h-6 w-6 shrink-0" />
      <p className="min-w-0 flex-1 text-13 leading-snug">
        <span className="mr-2 inline-flex items-center rounded-full border border-brand-300/70 px-2 py-0.5 align-middle font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-700 dark:border-brand/40 dark:text-brand-300">
          {r.badge}
        </span>
        <span className="font-medium text-ink dark:text-gray-200">{r.textApp}</span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={r.dismiss || "Dismiss"}
        className="shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-brand-100 hover:text-ink dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
        data-testid="rebrand-notice-dismiss"
      >
        <LuX className="h-4 w-4" />
      </button>
    </div>
  );
}
