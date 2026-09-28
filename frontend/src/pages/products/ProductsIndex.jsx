import { NavLink } from "react-router";
import { LuArrowRight, LuClock } from "react-icons/lu";
import MainLayout from "../../layouts/MainLayout";
import { PRODUCT_GROUPS } from "../../data/productCatalog";
import { usePageMeta } from "../../hooks/usePageMeta";

const ProductsIndex = () => {
  usePageMeta(
    "Products \u2014 Nameword",
    "The full offshore cloud: domains, servers, hosting, storage and more \u2014 privacy-first, no-KYC, pay with crypto."
  );

  return (
    <MainLayout fluid>
      <section className="nw-hero">
        <div className="nw-hero-glow -top-24 -right-24 h-80 w-80" />
        <div className="nw-container relative py-14 text-center sm:py-20">
          <span className="nw-kicker mb-4">The offshore cloud</span>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-primary dark:text-white sm:text-5xl">
            Everything you need to build, privately
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-soft dark:text-gray-400">
            A full cloud platform with the Nameword promise — offshore, DMCA-ignored, no-KYC and pay with crypto. Live products today, with more landing soon.
          </p>
        </div>
      </section>

      <section className="nw-section">
        <div className="nw-container flex flex-col gap-14">
          {PRODUCT_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-primary dark:text-white">{group.label}</h2>
                <p className="mt-1 text-15 text-ink-soft dark:text-gray-400">{group.desc}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {group.items.map((it) => (
                  <NavLink
                    key={it.slug}
                    to={it.to}
                    data-testid={`product-card-${it.slug}`}
                    className="nw-card nw-card-hover group relative flex flex-col"
                  >
                    <span className={`absolute right-4 top-4 ${it.status === "live" ? "nw-badge-success" : "nw-badge-accent"}`}>
                      {it.status === "live" ? "Live" : <><LuClock className="h-3 w-3" /> Soon</>}
                    </span>
                    <span className="nw-icon h-12 w-12"><it.icon className="h-6 w-6" /></span>
                    <h3 className="mt-5 text-lg font-bold text-primary dark:text-white">{it.name}</h3>
                    <p className="mt-2 flex-1 text-15 text-ink-soft dark:text-gray-400">{it.blurb}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-13 font-semibold text-brand-700 dark:text-brand-300">
                      {it.status === "live" ? "Explore" : "Join waitlist"}
                      <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </MainLayout>
  );
};

export default ProductsIndex;
