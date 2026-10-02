import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { motion as Motion, useReducedMotion } from "motion/react";
import { LuArrowRight, LuLock, LuBitcoin, LuZap } from "react-icons/lu";
import { useLanguage } from "../../../hooks/useLanguage";
import DomainSearchResults from "../../domain/DomainSearchResults";
import DomainSearchForm from "./DomainSearchForm";

// Popular TLDs with reference prices (the /pricing + search show live prices).
const TLD_CHIPS = [
  { tld: ".com", price: "39" },
  { tld: ".net", price: "51" },
  { tld: ".org", price: "29" },
  { tld: ".io", price: "244" },
  { tld: ".xyz", price: "19" },
];

const REASSURE_ICONS = [LuBitcoin, LuLock, LuZap];

// Bold, search-first hero. Live domain search is the centerpiece, with a crypto/
// no-KYC reassurance line and popular-TLD price chips just beneath it.
export default function Hero() {
  const { t } = useLanguage();
  const s = t.site.home;
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [submitted, setSubmitted] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const resultsRef = useRef(null);

  const onSearch = (q) => {
    setSubmitted(q);
    setSearching(true);
    setSearchNonce((n) => n + 1);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  const container = { animate: { transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: 0.03 } } };
  const fadeUp = {
    initial: { opacity: 0, y: reduced ? 0 : 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  const reassure = String(s.promo.heroReassure).split(" · ");

  return (
    <section className="relative overflow-hidden bg-white dark:bg-gray-950">
      {/* soft, warm gradient wash — media-rich but not crowding the search */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-gradient-to-b from-brand-50 via-brand-50/40 to-transparent dark:from-brand-500/[0.07] dark:via-brand-500/[0.03] dark:to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-neon/10 blur-3xl dark:bg-neon/10" />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-500/10" />

      <div className="nw-container relative py-20 sm:py-24 lg:py-28">
        <Motion.div variants={container} initial="initial" animate="animate" className="mx-auto max-w-4xl text-center">
          <Motion.div variants={fadeUp}>
            {/* terminal prompt line — the brand is the prompt */}
            <span
              className="hs-prompt rounded-full border border-line bg-white/70 px-3.5 py-1.5 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]"
              data-testid="hero-prompt"
            >
              <span className="hs-prompt-sign">$</span>
              <span>{s.eyebrow}</span>
              <span className="hs-cursor" aria-hidden="true" />
            </span>
          </Motion.div>

          <Motion.h1
            variants={fadeUp}
            className="mt-6 font-mono text-[1.7rem] font-bold leading-[1.1] tracking-[-0.035em] text-primary dark:text-white sm:text-5xl lg:text-[3.5rem]"
            data-testid="hero-heading"
          >
            {String(s.heading)
              .split(/(?<=\.)\s+/)
              .map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
          </Motion.h1>

          <Motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft dark:text-gray-400">
            {s.subheading}
          </Motion.p>

          <Motion.div variants={fadeUp} className="mx-auto mt-9 max-w-2xl">
            <DomainSearchForm
              testId="hero"
              placeholder={s.placeholder}
              buttonLabel={s.searchBtn}
              busyLabel={s.searching}
              busy={searching}
              onSubmit={onSearch}
              center
            />
          </Motion.div>

          {/* reassurance line just beneath the search */}
          <Motion.div variants={fadeUp} className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" data-testid="hero-reassure">
            {reassure.map((line, i) => {
              const Icon = REASSURE_ICONS[i] || LuLock;
              return (
                <span key={line} className="flex items-center gap-1.5 text-13 font-medium text-ink-soft dark:text-gray-400">
                  <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {line}
                </span>
              );
            })}
          </Motion.div>

          {/* popular TLD price chips */}
          <Motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft/80 dark:text-gray-500">{s.promo.popularTlds}</span>
            {TLD_CHIPS.map((c) => (
              <button
                key={c.tld}
                onClick={() => navigate(`/domains?value=${encodeURIComponent("yourname" + c.tld)}`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-13 font-medium text-primary transition-colors hover:border-brand/40 hover:bg-brand-50 dark:border-white/10 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand/40 dark:hover:bg-white/[0.05]"
                data-testid={`hero-tld-${c.tld.slice(1)}`}
              >
                <span className="font-semibold">{c.tld}</span>
                <span className="text-ink-soft dark:text-gray-400">${c.price}</span>
              </button>
            ))}
          </Motion.div>

          <Motion.div variants={fadeUp} className="mt-7">
            <button
              onClick={() => {
                const el = document.getElementById("vps");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                else navigate("/vps");
              }}
              className="inline-flex items-center gap-1.5 text-15 font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
              data-testid="hero-need-servers-link"
            >
              {s.needServers} <LuArrowRight className="h-4 w-4" />
            </button>
          </Motion.div>
        </Motion.div>
      </div>

      {submitted && (
        <div ref={resultsRef} className="nw-container relative scroll-mt-24 pb-16" data-testid="hero-search-results">
          <DomainSearchResults query={submitted} nonce={searchNonce} onLoadingChange={setSearching} />
        </div>
      )}
    </section>
  );
}
