import { LuMapPin, LuEyeOff, LuKeyRound, LuWallet, LuGlobe, LuCheck, LuShieldCheck } from "react-icons/lu";
import { useLanguage } from "../../../hooks/useLanguage";
import Reveal from "./Reveal";

const PILLAR_ICONS = [LuMapPin, LuEyeOff, LuKeyRound, LuWallet];
const STEP_ICONS = [LuGlobe, LuWallet, LuKeyRound];

// Light, on-brand styled mock (no photo) that varies subtly per pillar.
function PillarVisual({ index }) {
  const Icon = PILLAR_ICONS[index] || LuShieldCheck;
  const chips = [
    ["Offshore", "DMCA-ignored"],
    ["WHOIS hidden", "No logs"],
    ["root@server", "Your keys"],
    ["Wallet", "+ rewards"],
  ][index] || ["Private", "Active"];
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-white p-8 dark:border-white/[0.07] dark:from-brand-500/[0.08] dark:to-gray-900">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-400/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/15 blur-2xl" />
      <div className="relative w-full max-w-xs rounded-2xl border border-line bg-white p-5 shadow-xl shadow-slate-200/60 dark:border-white/[0.08] dark:bg-gray-950 dark:shadow-black/40">
        <div className="flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-500 text-white shadow-lg shadow-brand-500/25"><Icon className="h-6 w-6" /></span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-600 dark:text-green-400"><span className="h-2 w-2 rounded-full bg-green-500" /> Live</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-2.5 w-3/4 rounded-full bg-surface-3 dark:bg-white/10" />
          <div className="h-2.5 w-1/2 rounded-full bg-surface-3 dark:bg-white/10" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:bg-brand/15 dark:text-brand-200">{chips[0]}</span>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">{chips[1]}</span>
        </div>
      </div>
    </div>
  );
}

// Media-rich "Why hosta.sh": alternating text + visual rows, privacy checklist and
// a compact 3-step "how it works".
export default function WhyNameword() {
  const { t } = useLanguage();
  const home = t.site.home;
  const s = home.pillars;
  const steps = home.steps;
  const privacy = home.privacy;

  return (
    <section id="why" className="nw-section bg-surface-2 dark:bg-gray-900/40">
      <div className="nw-container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="nw-kicker mb-4">{s.eyebrow}</span>
          <h2 className="nw-h2">{s.title}</h2>
          <p className="nw-lead mt-4">{s.lead}</p>
        </Reveal>

        <div className="mt-14 space-y-16 sm:space-y-20">
          {s.items.map((p, i) => {
            const Icon = PILLAR_ICONS[i] || LuShieldCheck;
            const flip = i % 2 === 1;
            return (
              <Reveal key={p.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14" data-testid={`pillar-${i}`}>
                <div className={flip ? "lg:order-2" : ""}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-md ring-1 ring-line dark:bg-gray-950 dark:text-brand-300 dark:ring-white/10"><Icon className="h-6 w-6" /></span>
                  <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-primary dark:text-white sm:text-3xl">{p.title}</h3>
                  <p className="mt-3 text-lg leading-relaxed text-ink-soft dark:text-gray-400">{p.desc}</p>
                </div>
                <div className={flip ? "lg:order-1" : ""}>
                  <PillarVisual index={i} />
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-16 rounded-2xl border border-line bg-white p-6 dark:border-white/[0.06] dark:bg-gray-950 sm:p-8" data-testid="privacy-freedom">
          <span className="nw-kicker mb-5"><LuShieldCheck className="h-3.5 w-3.5" /> {privacy.eyebrow}</span>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {privacy.items.map((line, i) => (
              <li key={line} className="flex items-start gap-3" data-testid={`privacy-item-${i}`}>
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300"><LuCheck className="h-3.5 w-3.5" /></span>
                <span className="text-15 font-medium text-primary dark:text-gray-100">{line}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="mt-16">
          <Reveal className="max-w-2xl">
            <span className="nw-kicker mb-3">{steps.eyebrow}</span>
            <h3 className="font-display text-2xl font-bold tracking-tight text-primary dark:text-white sm:text-3xl">{steps.title}</h3>
          </Reveal>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.items.map((step, i) => {
              const Icon = STEP_ICONS[i] || LuCheck;
              return (
                <Reveal as="li" key={step.title} delay={i * 0.08} data-testid={`step-${i}`}>
                  <div className="flex items-center gap-4">
                    <span className="nw-icon h-12 w-12"><Icon className="h-6 w-6" /></span>
                    <span className="font-display text-3xl font-bold text-brand-200 dark:text-brand/40">0{i + 1}</span>
                  </div>
                  <h4 className="mt-5 text-lg font-bold text-primary dark:text-white">{step.title}</h4>
                  <p className="mt-2 text-15 text-ink-soft dark:text-gray-400">{step.desc}</p>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
