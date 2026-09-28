import { useParams, Navigate, NavLink } from "react-router";
import { LuArrowLeft, LuCheck, LuClock } from "react-icons/lu";
import MainLayout from "../../layouts/MainLayout";
import WaitlistForm from "../../components/marketing/WaitlistForm";
import { getProductBySlug } from "../../data/productCatalog";
import { usePageMeta } from "../../hooks/usePageMeta";

const ComingSoonPage = () => {
  const { slug } = useParams();
  const product = getProductBySlug(slug);

  usePageMeta(
    product ? `${product.name} \u2014 Coming soon` : "Coming soon",
    product?.summary
  );

  if (!product) return <Navigate to="/products" replace />;
  if (product.status === "live") return <Navigate to={product.to} replace />;

  const Icon = product.icon;
  const features = product.features || [];

  return (
    <MainLayout fluid>
      <section className="nw-hero">
        <div className="nw-hero-glow -top-24 -right-24 h-80 w-80" />
        <div className="nw-container relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-12">
          <div>
            <NavLink
              to="/products"
              className="mb-6 inline-flex items-center gap-1.5 text-13 font-semibold text-ink-soft hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-300"
            >
              <LuArrowLeft className="h-4 w-4" /> All products
            </NavLink>
            <div className="mb-4">
              <span className="nw-badge-accent"><LuClock className="h-3.5 w-3.5" /> Coming soon</span>
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-primary dark:text-white sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft dark:text-gray-400">{product.summary}</p>
            <div className="mt-8 max-w-md">
              <WaitlistForm slug={product.slug} name={product.name} />
            </div>
          </div>
          <div className="relative">
            <div className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-3xl border border-line nw-grad-brand text-white shadow-2xl shadow-slate-300/40 dark:border-white/[0.08] dark:shadow-black/60 sm:h-[420px]">
              <Icon className="h-36 w-36 opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950/45 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {features.length > 0 && (
        <section className="nw-section">
          <div className="nw-container">
            <h2 className="nw-h2 text-center">What to expect</h2>
            <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title} className="nw-card">
                  <div className="flex items-start gap-3">
                    <span className="nw-icon h-10 w-10 shrink-0"><LuCheck className="h-5 w-5" /></span>
                    <div>
                      <h3 className="text-base font-bold text-primary dark:text-white">{f.title}</h3>
                      <p className="mt-1 text-15 text-ink-soft dark:text-gray-400">{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-13 text-ink-soft dark:text-gray-500">
              Privacy-first · No-KYC · Pay with crypto — same promise, new product.
            </p>
          </div>
        </section>
      )}
    </MainLayout>
  );
};

export default ComingSoonPage;
