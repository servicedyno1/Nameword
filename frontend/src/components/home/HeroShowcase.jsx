import { useEffect, useState } from "react";
import { motion as Motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useLanguage } from "../../hooks/useLanguage";
import {
  LuGlobe,
  LuServer,
  LuCloud,
  LuNetwork,
  LuSearch,
  LuCheck,
  LuX,
  LuLock,
  LuShieldCheck,
  LuMapPin,
  LuWallet,
} from "react-icons/lu";

const SCENES = [
  { key: "domains", icon: LuGlobe },
  { key: "hosting", icon: LuServer },
  { key: "servers", icon: LuCloud },
  { key: "manage", icon: LuNetwork },
];

const INTERVAL = 3800; // ms per scene

/* ---------- individual storyboard scenes ---------- */

function DomainsScene({ sc, item }) {
  const rows = [
    { name: "yourname.com", price: "$39", ok: true },
    { name: "yourname.io", price: "$244", ok: true },
    { name: "yourname.co", price: "—", ok: false },
  ];
  return (
    <>
      <Motion.div
        variants={item}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]"
      >
        <LuSearch className="h-4 w-4 text-brand-500" />
        <span className="text-sm font-semibold text-primary dark:text-white">
          yourname<span className="text-ink-muted">.com</span>
        </span>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {sc.domains.available}
        </span>
      </Motion.div>
      {rows.map((r) => (
        <Motion.div
          key={r.name}
          variants={item}
          className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 dark:border-white/10 dark:bg-gray-900"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-primary dark:text-gray-200">
            {r.ok ? (
              <LuCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <LuX className="h-4 w-4 text-ink-muted" />
            )}
            {r.name}
          </span>
          {r.ok ? (
            <span className="text-sm font-bold text-brand dark:text-brand-300">{r.price}</span>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{sc.domains.taken}</span>
          )}
        </Motion.div>
      ))}
    </>
  );
}

function Metric({ item, label, value, pct }) {
  return (
    <Motion.div variants={item} className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-medium text-ink-soft dark:text-gray-400">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.06]">
        <Motion.div
          className="h-full rounded-full bg-brand"
          initial={{ width: 0 }}
          animate={{ width: pct }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.25 }}
        />
      </div>
    </Motion.div>
  );
}

function HostingScene({ sc, item }) {
  return (
    <>
      <Motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="nw-icon h-9 w-9 rounded-lg">
            <LuServer className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-primary dark:text-white">{sc.hosting.title}</p>
            <p className="text-[11px] text-ink-soft dark:text-gray-400">{sc.hosting.region}</p>
          </div>
        </div>
        <span className="nw-badge-success">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {sc.hosting.status}
        </span>
      </Motion.div>
      <Metric item={item} label={sc.hosting.disk} value="24 / 100 GB" pct="38%" />
      <Metric item={item} label={sc.hosting.bandwidth} value="620 GB" pct="62%" />
    </>
  );
}

function ServersScene({ sc, item }) {
  const specs = [
    { v: "4", l: sc.servers.cpu },
    { v: "8 GB", l: sc.servers.ram },
    { v: "160 GB", l: sc.servers.ssd },
  ];
  return (
    <>
      <Motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="nw-icon h-9 w-9 rounded-lg">
            <LuCloud className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-primary dark:text-white">{sc.servers.title}</p>
            <p className="text-[11px] text-ink-soft dark:text-gray-400">{sc.servers.region}</p>
          </div>
        </div>
        <span className="nw-badge-success">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {sc.servers.status}
        </span>
      </Motion.div>
      <Motion.div variants={item} className="grid grid-cols-3 gap-2">
        {specs.map((sp) => (
          <div
            key={sp.l}
            className="rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-center dark:border-white/10 dark:bg-white/[0.03]"
          >
            <p className="text-base font-bold text-primary dark:text-white">{sp.v}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-muted">{sp.l}</p>
          </div>
        ))}
      </Motion.div>
      <Motion.div
        variants={item}
        className="rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 font-mono text-[11px] text-brand-200"
      >
        <span className="text-ink-muted">$</span> nw deploy --region sg
        <span className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-brand-300" />
      </Motion.div>
    </>
  );
}

function ManageScene({ sc, item }) {
  const records = [
    { type: "A", name: "@", value: "192.0.2.10" },
    { type: "CNAME", name: "www", value: "yourname.com" },
    { type: "MX", name: "mail", value: "10" },
  ];
  return (
    <>
      <Motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="nw-icon h-9 w-9 rounded-lg">
            <LuNetwork className="h-4 w-4" />
          </span>
          <p className="text-sm font-bold text-primary dark:text-white">{sc.manage.title}</p>
        </div>
        <span className="nw-badge-success">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {sc.manage.propagated}
        </span>
      </Motion.div>
      {records.map((rec) => (
        <Motion.div
          key={rec.type + rec.name}
          variants={item}
          className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 dark:border-white/10 dark:bg-gray-900"
        >
          <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700 dark:bg-brand/15 dark:text-brand-300">
            {rec.type}
          </span>
          <span className="text-[11px] font-medium text-primary dark:text-gray-200">{rec.name}</span>
          <span className="ml-auto font-mono text-[11px] text-ink-soft dark:text-gray-400">{rec.value}</span>
        </Motion.div>
      ))}
      <Motion.div
        variants={item}
        className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-ink-soft dark:text-gray-400">
          <LuWallet className="h-4 w-4 text-brand-500" /> {sc.manage.wallet}
        </span>
        <span className="font-mono text-sm font-bold text-primary dark:text-white">$124.00</span>
      </Motion.div>
    </>
  );
}

const SCENE_COMPONENTS = {
  domains: DomainsScene,
  hosting: HostingScene,
  servers: ServersScene,
  manage: ManageScene,
};

/* ---------- carousel shell ---------- */

export default function HeroShowcase({ onDark = false }) {
  const { t } = useLanguage();
  const s = t.site.home;
  const sc = s.showcase;
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const tabActive = onDark
    ? "border-white/25 bg-white/15 text-white backdrop-blur-md"
    : "border-brand/40 bg-brand-50 text-brand-700 dark:border-brand/40 dark:bg-brand/15 dark:text-brand-300";
  const tabIdle = onDark
    ? "border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
    : "border-line text-ink-soft hover:text-primary dark:border-white/10 dark:text-gray-400 dark:hover:text-white";

  useEffect(() => {
    if (paused) return undefined;
    const id = setTimeout(() => setActive((a) => (a + 1) % SCENES.length), INTERVAL);
    return () => clearTimeout(id);
  }, [active, paused]);

  const container = {
    initial: { opacity: 0, x: reduced ? 0 : 28 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.4, ease: "easeOut", when: "beforeChildren", staggerChildren: reduced ? 0 : 0.07 },
    },
    exit: { opacity: 0, x: reduced ? 0 : -28, transition: { duration: 0.25 } },
  };
  const item = {
    initial: { opacity: 0, y: reduced ? 0 : 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  };

  const activeKey = SCENES[active].key;
  const SceneBody = SCENE_COMPONENTS[activeKey];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="hero-showcase"
    >
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SCENES.map((def, i) => {
          const isActive = i === active;
          return (
            <button
              key={def.key}
              onClick={() => setActive(i)}
              data-testid={`hero-showcase-tab-${def.key}`}
              className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                isActive ? tabActive : tabIdle
              }`}
            >
              <def.icon className="h-3.5 w-3.5" /> {sc.tabs[def.key]}
              {isActive && !reduced && !paused && (
                <Motion.span
                  key={active}
                  className={`absolute inset-x-0 bottom-0 h-0.5 origin-left ${onDark ? "bg-brand-300" : "bg-brand"}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: INTERVAL / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Window */}
      <Motion.div
        initial={{ opacity: 0, y: reduced ? 0 : 24, scale: reduced ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`relative overflow-hidden rounded-3xl border border-line bg-white dark:border-white/[0.08] dark:bg-gray-900 ${
          onDark ? "shadow-2xl shadow-black/50" : "shadow-2xl shadow-slate-300/40 dark:shadow-black/60"
        }`}
      >
        {/* Chrome */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 dark:border-white/[0.06]">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1 text-[11px] font-medium text-ink-soft dark:bg-white/[0.04] dark:text-gray-400">
            <LuLock className="h-3 w-3 text-emerald-500" /> hosta.sh
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" /> {sc.live}
          </span>
        </div>

        {/* Body */}
        <div className="relative min-h-[300px] p-4">
          <AnimatePresence mode="wait">
            <Motion.div
              key={activeKey}
              variants={container}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-3"
            >
              <SceneBody sc={sc} item={item} />
            </Motion.div>
          </AnimatePresence>
        </div>
      </Motion.div>

      {/* Floating cards */}
      <Motion.div
        animate={reduced ? {} : { y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-5 left-2 flex items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-white/[0.08] dark:bg-gray-900/95 sm:left-6"
      >
        <span className="nw-icon h-10 w-10 rounded-full">
          <LuShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-primary dark:text-white">{s.heroFloat.title}</p>
          <p className="text-13 text-ink-soft dark:text-gray-400">{s.heroFloat.sub}</p>
        </div>
      </Motion.div>

      <Motion.div
        animate={reduced ? {} : { y: [0, 9, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute -top-[4.5rem] right-0 hidden items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-white/[0.08] dark:bg-gray-900/95 sm:flex"
      >
        <span className="nw-icon h-10 w-10 rounded-full">
          <LuMapPin className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-primary dark:text-white">{s.heroFloat2.title}</p>
          <p className="text-13 text-ink-soft dark:text-gray-400">{s.heroFloat2.sub}</p>
        </div>
      </Motion.div>
    </div>
  );
}
