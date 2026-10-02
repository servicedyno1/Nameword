import { useState } from "react";
import { LuX } from "react-icons/lu";
import { useLanguage } from "../../../hooks/useLanguage";
import { HostaMark } from "../../common/BrandLogo";
import { REBRAND_NOTICE_KEY } from "../../common/RebrandNotice";

// Thin, dismissible terminal-style strip at the very top of the landing.
// Phase 2 rebrand: announces "Nameword is now hosta.sh" to returning customers.
export default function AnnouncementBar() {
  const { t } = useLanguage();
  const p = t.site.home.promo;
  const r = t.site.rebrand || {};
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(REBRAND_NOTICE_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(REBRAND_NOTICE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="relative z-30 border-b border-white/10 bg-[#12101F] text-[#E8E6FF] dark:bg-[#0F0D1C]" data-testid="announcement-bar">
      <div className="nw-container flex items-center justify-center gap-2.5 py-2.5 pr-8 text-center">
        <HostaMark className="hidden h-4 w-4 shrink-0 sm:block" tone="onDark" />
        <span className="hidden shrink-0 rounded-full border border-[#22E6FF]/40 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#22E6FF] sm:inline-flex">
          {r.badge}
        </span>
        <p className="text-[13px] font-medium tracking-tight text-[#E8E6FF]/95">{r.text || p.announce}</p>
      </div>
      <button
        onClick={dismiss}
        aria-label={r.dismiss || p.announceDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        data-testid="announcement-dismiss"
      >
        <LuX className="h-4 w-4" />
      </button>
    </div>
  );
}
