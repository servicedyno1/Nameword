import { useNavigate } from "react-router";
import { LuGlobe, LuNetwork, LuServer, LuCloud, LuMonitor, LuCode, LuArrowRight } from "react-icons/lu";
import { useLanguage } from "../../../hooks/useLanguage";
import { useAuth } from "../../../hooks/useAuth";
import Reveal from "./Reveal";

const PRODUCTS = [
  { key: "domains", to: "/domains", icon: LuGlobe },
  { key: "dns", to: "/dns-manager", icon: LuNetwork, protectedRoute: true },
  { key: "hosting", to: "/hosting", icon: LuServer },
  { key: "vps", to: "/vps", icon: LuCloud },
  { key: "rdp", to: "/rdp", icon: LuMonitor },
];
const API = { key: "api", to: "/api", icon: LuCode };

function ProductCard({ p, item, explore, onClick }) {
  return (
    <button
      onClick={onClick}
      className="nw-card nw-card-hover group flex w-full flex-col items-start p-6 text-left"
      data-testid={`product-card-${p.key}`}
    >
      <span className="nw-icon h-12 w-12"><p.icon className="h-6 w-6" /></span>
      <h3 className="mt-5 text-lg font-bold text-primary dark:text-white">{item.title}</h3>
      <p className="mt-2 text-15 text-ink-soft dark:text-gray-400">{item.desc}</p>
      <div className="mt-auto flex w-full items-center justify-between pt-6">
        <span className="nw-mono">{item.price}</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition-all group-hover:gap-2 dark:text-brand-300">
          {explore} <LuArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function ApiCard({ item, explore, onClick }) {
  return (
    <button
      onClick={onClick}
      className="nw-card nw-card-hover group grid gap-6 p-6 text-left sm:col-span-2 sm:p-8 lg:col-span-3 lg:grid-cols-[1fr_1.1fr] lg:items-center"
      data-testid="product-card-api"
    >
      <div>
        <span className="nw-icon h-12 w-12"><LuCode className="h-6 w-6" /></span>
        <h3 className="mt-5 text-lg font-bold text-primary dark:text-white sm:text-xl">{item.title}</h3>
        <p className="mt-2 text-15 text-ink-soft dark:text-gray-400">{item.desc}</p>
        <div className="mt-6 flex items-center gap-4">
          <span className="nw-mono">{item.price}</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition-all group-hover:gap-2 dark:text-brand-300">
            {explore} <LuArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-ink-soft dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-gray-300">
        <span className="text-brand-600 dark:text-brand-400">$</span>{' curl -H "Authorization: Bearer ···" \\'}
        <span className="mt-1 block pl-4">api.hosta.sh/v1/domains</span>
        <span className="mt-1 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-brand-500" />
      </div>
    </button>
  );
}

export default function Products() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const s = t.site.home.products;
  const navigate = useNavigate();

  const go = (p) => {
    if (p.protectedRoute && !user) {
      localStorage.setItem("path", p.to);
      navigate("/sign-in");
      return;
    }
    navigate(p.to);
  };

  return (
    <section id="products" className="nw-section">
      <div className="nw-container">
        <Reveal className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <span className="nw-kicker mb-4">{s.eyebrow}</span>
            <h2 className="nw-h2">{s.title}</h2>
            <p className="nw-lead mt-4">{s.lead}</p>
          </div>
          <button onClick={() => navigate("/pricing")} className="nw-btn-secondary" data-testid="products-pricing-link">
            {t.site.home.pricing.fullTable} <LuArrowRight className="h-4 w-4" />
          </button>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.key} delay={(i % 3) * 0.08} className="flex">
              <ProductCard p={p} item={s.items[p.key]} explore={s.explore} onClick={() => go(p)} />
            </Reveal>
          ))}
          <Reveal className="grid sm:col-span-2 lg:col-span-3">
            <ApiCard item={s.items.api} explore={s.explore} onClick={() => go(API)} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
