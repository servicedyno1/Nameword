import { NavLink } from "react-router";
import { LuArrowRight, LuClock } from "react-icons/lu";
import { PRODUCT_GROUPS } from "../../../data/productCatalog";
import { SectionHeading } from "../../marketing/marketing-ui";

// Home "grouped product grid" — the Hostman-style cloud catalog. Live products
// link to their storefronts; "soon" products link to their waitlist pages.
const CloudCatalog = () => {
  return (
    <section className="nw-section" data-testid="home-cloud-catalog">
      <div className="nw-container">
        <SectionHeading
          eyebrow="The offshore cloud"
          title="A full cloud platform, privacy-first"
          subtitle="Domains, servers and hosting you can run today — with managed databases, storage, Kubernetes and more landing soon. Same promise: offshore, DMCA-ignored, no-KYC, pay with crypto."
        />
        <div className="mt-14 flex flex-col gap-12">
          {PRODUCT_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="mb-5 flex items-center gap-3">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">{group.label}</h3>
                <span className="h-px flex-1 bg-line dark:bg-white/[0.08]" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {group.items.map((it) => (
                  <NavLink
                    key={it.slug}
                    to={it.to}
                    data-testid={`catalog-card-${it.slug}`}
                    className="nw-card nw-card-hover group relative flex flex-col"
                  >
                    <span className={`absolute right-4 top-4 ${it.status === "live" ? "nw-badge-success" : "nw-badge-accent"}`}>
                      {it.status === "live" ? "Live" : <><LuClock className="h-3 w-3" /> Soon</>}
                    </span>
                    <span className="nw-icon h-11 w-11"><it.icon className="h-5 w-5" /></span>
                    <h4 className="mt-4 text-base font-bold text-primary dark:text-white">{it.name}</h4>
                    <p className="mt-1.5 flex-1 text-13 text-ink-soft dark:text-gray-400">{it.blurb}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-13 font-semibold text-brand-700 dark:text-brand-300">
                      {it.status === "live" ? "Explore" : "Join waitlist"}
                      <LuArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <NavLink to="/products" className="nw-btn-secondary" data-testid="catalog-all-products">
            Browse all products <LuArrowRight className="h-4 w-4" />
          </NavLink>
        </div>
      </div>
    </section>
  );
};

export default CloudCatalog;
