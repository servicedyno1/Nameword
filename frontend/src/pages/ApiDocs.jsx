import { useMemo, useState } from "react";
import { NavLink } from "react-router";
import ProductShell from "../components/layout/ProductShell";
import { useAuth } from "../hooks/useAuth";
import { usePageMeta } from "../hooks/usePageMeta";
import { LuKeyRound, LuCopy, LuCheck, LuExternalLink } from "react-icons/lu";

const API_BASE =
  (typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : import.meta.env.VITE_API_BASE_URL || "") + "/api/v1";

const METHOD_STYLES = {
  GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST: "bg-brand-50 text-brand-700 dark:bg-brand/15 dark:text-brand-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const GROUPS = [
  {
    id: "meta",
    title: "Service status",
    endpoints: [
      { m: "GET", p: "/reseller/health", d: "Service health & provider mode. No auth required.", auth: false },
      { m: "GET", p: "/reseller/account", d: "Your reseller account summary." },
    ],
  },
  {
    id: "domains",
    title: "Domains",
    endpoints: [
      { m: "GET", p: "/reseller/domains/search?domain=example.com", d: "Check availability & price. No auth required.", auth: false },
      { m: "GET", p: "/reseller/domains/suggest?domain=keyword", d: "Alternative TLD suggestions. No auth required.", auth: false },
      { m: "GET", p: "/reseller/domains", d: "List the domains you own." },
      { m: "POST", p: "/reseller/domains/register", d: "Register a domain. Body: { domain, ns_choice }." },
    ],
  },
  {
    id: "dns",
    title: "DNS",
    endpoints: [
      { m: "GET", p: "/reseller/dns/:domain/records", d: "List DNS records for a domain you own." },
      { m: "POST", p: "/reseller/dns/:domain/records", d: "Add a record. Body: { type, name, value, ttl? }." },
      { m: "PUT", p: "/reseller/dns/:domain/records", d: "Update a record." },
      { m: "DELETE", p: "/reseller/dns/:domain/records", d: "Delete a record." },
      { m: "PUT", p: "/reseller/dns/:domain/nameservers", d: "Set custom nameservers. Body: { nameservers: [] }." },
    ],
  },
  {
    id: "vps",
    title: "VPS (Linux)",
    endpoints: [
      { m: "GET", p: "/reseller/vps/plans?region=EU", d: "List VPS plans. No auth required.", auth: false },
      { m: "GET", p: "/reseller/vps", d: "List your servers." },
      { m: "POST", p: "/reseller/vps", d: "Deploy a server. Body: { plan_id, region, hostname?, os? }." },
      { m: "GET", p: "/reseller/vps/:id", d: "Server details." },
      { m: "POST", p: "/reseller/vps/:id/action", d: "Power action. Body: { action: 'start'|'stop'|'reboot' }." },
      { m: "GET", p: "/reseller/vps/:id/credentials", d: "Retrieve login credentials." },
      { m: "DELETE", p: "/reseller/vps/:id", d: "Destroy the server." },
    ],
  },
  {
    id: "rdp",
    title: "RDP (Windows)",
    endpoints: [
      { m: "GET", p: "/reseller/rdp/plans?region=EU", d: "List RDP plans. No auth required.", auth: false },
      { m: "GET", p: "/reseller/rdp", d: "List your RDP desktops." },
      { m: "POST", p: "/reseller/rdp", d: "Deploy an RDP desktop. Body: { plan_id, region }." },
      { m: "GET", p: "/reseller/rdp/:id", d: "Desktop details." },
      { m: "POST", p: "/reseller/rdp/:id/action", d: "Power action. Body: { action }." },
      { m: "GET", p: "/reseller/rdp/:id/credentials", d: "Retrieve login credentials." },
      { m: "DELETE", p: "/reseller/rdp/:id", d: "Destroy the desktop." },
    ],
  },
  {
    id: "hosting",
    title: "cPanel Hosting",
    endpoints: [
      { m: "GET", p: "/reseller/hosting/plans", d: "List hosting plans. No auth required.", auth: false },
      { m: "GET", p: "/reseller/hosting", d: "List your hosting accounts." },
      { m: "POST", p: "/reseller/hosting", d: "Create hosting. Body: { plan_id, domain, domain_mode? }." },
      { m: "GET", p: "/reseller/hosting/:user", d: "Account details & deliverables." },
      { m: "POST", p: "/reseller/hosting/:user/upgrade", d: "Upgrade the plan. Body: { plan_id }." },
      { m: "GET", p: "/reseller/hosting/:user/credentials", d: "cPanel credentials." },
      { m: "DELETE", p: "/reseller/hosting/:user", d: "Terminate the account." },
    ],
  },
  {
    id: "wallet",
    title: "Wallet",
    endpoints: [
      { m: "GET", p: "/wallet/get", d: "Your prepaid wallet balance." },
      { m: "GET", p: "/wallet/transactions", d: "Wallet transaction history." },
      { m: "POST", p: "/wallet/dynocheckout-url", d: "Create a crypto top-up checkout. Body: { amount }." },
    ],
  },
  {
    id: "checkout",
    title: "Checkout & Orders",
    endpoints: [
      { m: "POST", p: "/checkout/quote", d: "Price a cart. Body: { items: [] }." },
      { m: "POST", p: "/checkout/orders", d: "Place an order paid from your wallet. Body: { items, client_order_id }." },
      { m: "POST", p: "/checkout/orders/crypto", d: "Pay an order directly with crypto." },
      { m: "GET", p: "/checkout/orders", d: "List your orders." },
      { m: "GET", p: "/checkout/orders/:id/status", d: "Poll provisioning status for an order." },
      { m: "GET", p: "/checkout/renewals", d: "Unified list of expiring services." },
      { m: "POST", p: "/checkout/orders/:id/items/:idx/renew", d: "Renew a single item from your wallet." },
    ],
  },
];

function CodeBlock({ code, testid }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gray-950 text-gray-200 shadow-lg">
      <button
        type="button"
        onClick={copy}
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-gray-200 hover:bg-white/[0.12]"
      >
        {copied ? <LuCheck className="h-3.5 w-3.5" /> : <LuCopy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto whitespace-pre p-4 pr-20 font-mono text-[13px] leading-relaxed" data-testid={testid}>
        {code}
      </pre>
    </div>
  );
}

export default function ApiDocs() {
  const { user } = useAuth();
  usePageMeta("API Documentation", "Programmatic access to every hosta.sh service with a single API key.");

  const keysTo = user ? "/account-setting?tab=api-key" : "/sign-in";

  const curlExample = useMemo(
    () => `curl -s ${API_BASE}/reseller/vps/plans?region=EU \\
  -H "x-api-key: <userId>|<apiKey>" \\
  -H "Accept: application/json"`,
    []
  );

  const orderExample = useMemo(
    () => `curl -s -X POST ${API_BASE}/checkout/orders \\
  -H "x-api-key: <userId>|<apiKey>" \\
  -H "Content-Type: application/json" \\
  -d '{"items":[{"type":"domain","domain":"example.com","ns_choice":"cloudflare"}],"client_order_id":"<uuid>"}'`,
    []
  );

  return (
    <ProductShell>
      <div className="nw-container py-10" data-testid="api-docs-page">
        {/* Header */}
        <div className="max-w-3xl">
          <span className="nw-eyebrow mb-4">Developers</span>
          <h1 className="text-3xl font-bold tracking-tight text-primary dark:text-white sm:text-4xl">
            API Documentation
          </h1>
          <p className="mt-3 nw-lead">
            One API key authenticates every service we provide — domains, DNS, VPS, RDP, hosting,
            wallet and checkout. All endpoints are served under a single base URL and secured with an
            <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 text-[13px] dark:bg-white/10">x-api-key</code>
            header.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <NavLink to={keysTo} className="nw-btn-primary" data-testid="docs-get-key">
              <LuKeyRound className="h-4 w-4" /> {user ? "Manage API keys" : "Sign in to get a key"}
            </NavLink>
            <a href="#auth" className="nw-btn-secondary">Read the auth guide</a>
          </div>
        </div>

        {/* Section nav + content */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* In-page nav */}
          <nav className="hidden lg:block sticky top-24 self-start space-y-1 text-sm">
            <a href="#auth" className="block rounded-lg px-3 py-2 text-ink-soft hover:bg-surface-2 hover:text-primary dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white">Authentication</a>
            {GROUPS.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="block rounded-lg px-3 py-2 text-ink-soft hover:bg-surface-2 hover:text-primary dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white">
                {g.title}
              </a>
            ))}
          </nav>

          <div className="space-y-12 min-w-0">
            {/* Authentication */}
            <section id="auth" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-primary dark:text-white">Authentication</h2>
              <p className="mt-2 text-15 text-ink-soft dark:text-gray-400">
                Create an API key under{" "}
                <NavLink to={keysTo} className="nw-link">Account Settings → API Keys</NavLink>. Your key
                looks like <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px] dark:bg-white/10">&lt;userId&gt;|&lt;apiKey&gt;</code> — send it on every
                request in the <strong>x-api-key</strong> header. Keep it secret; it grants full access to your account.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="nw-card">
                  <p className="text-xs uppercase tracking-wider text-ink-soft dark:text-gray-500">Base URL</p>
                  <p className="mt-1 break-all font-mono text-[13px] text-brand-600 dark:text-brand-400" data-testid="docs-base-url">{API_BASE}</p>
                </div>
                <div className="nw-card">
                  <p className="text-xs uppercase tracking-wider text-ink-soft dark:text-gray-500">Auth header</p>
                  <p className="mt-1 font-mono text-[13px]">
                    <span className="text-brand-600 dark:text-brand-400">x-api-key</span>: &lt;userId&gt;|&lt;apiKey&gt;
                  </p>
                </div>
              </div>

              <p className="mt-6 mb-2 text-sm font-medium text-primary dark:text-white">Example — list VPS plans</p>
              <CodeBlock code={curlExample} testid="docs-curl-example" />

              <p className="mt-6 mb-2 text-sm font-medium text-primary dark:text-white">Example — place an order</p>
              <CodeBlock code={orderExample} testid="docs-order-example" />
            </section>

            {/* Endpoint groups */}
            {GROUPS.map((g) => (
              <section key={g.id} id={g.id} className="scroll-mt-24">
                <h2 className="text-xl font-semibold text-primary dark:text-white">{g.title}</h2>
                <div className="mt-4 overflow-hidden rounded-xl border border-line dark:border-white/[0.07]">
                  {g.endpoints.map((e, i) => (
                    <div
                      key={e.m + e.p}
                      className={`flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 ${
                        i > 0 ? "border-t border-line dark:border-white/[0.07]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:w-[52%] min-w-0">
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${METHOD_STYLES[e.m]}`}>{e.m}</span>
                        <code className="truncate font-mono text-[13px] text-primary dark:text-gray-200">{e.p}</code>
                      </div>
                      <p className="flex-1 text-13 text-ink-soft dark:text-gray-400">
                        {e.d}
                        {e.auth === false && (
                          <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft dark:bg-white/10 dark:text-gray-300">public</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <p className="flex items-center gap-2 text-13 text-ink-soft dark:text-gray-400">
              <LuExternalLink className="h-4 w-4" />
              Rate limits and detailed field references are coming soon. Questions? Reach us via{" "}
              <NavLink to="/help-support" className="nw-link">Help &amp; Support</NavLink>.
            </p>
          </div>
        </div>
      </div>
    </ProductShell>
  );
}
