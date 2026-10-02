import {
  LuGlobe, LuNetwork, LuServer, LuCloud, LuMonitor, LuCode,
  LuDatabase, LuBoxes, LuHardDrive, LuCpu, LuBot, LuScale, LuLayers,
} from "react-icons/lu";

// Single source of truth for the product taxonomy — powers the nav mega-menu,
// the home catalog section, the /products index and the /products/:slug pages.
// Hostman-style grouping; hosta.sh's live products folded in, new cloud
// categories added as "coming soon" (real waitlist, no fake provisioning).
export const PRODUCT_GROUPS = [
  {
    key: "compute",
    label: "Compute",
    desc: "Raw power on demand",
    items: [
      {
        slug: "cloud-servers", name: "Cloud Servers", status: "live", to: "/vps", icon: LuCloud,
        blurb: "Scalable offshore VPS, deploy in seconds",
        summary: "High-performance offshore virtual servers you can spin up in seconds and pay for with crypto.",
      },
      {
        slug: "windows-rdp", name: "Windows RDP", status: "live", to: "/rdp", icon: LuMonitor,
        blurb: "Private remote desktops, pay in crypto",
        summary: "Private Windows remote desktops in offshore jurisdictions, no KYC required.",
      },
      {
        slug: "bare-metal", name: "Bare Metal", status: "soon", to: "/products/bare-metal", icon: LuCpu,
        blurb: "Dedicated single-tenant servers",
        summary: "Fully dedicated, single-tenant servers for maximum performance, isolation and privacy \u2014 no noisy neighbours, ever.",
        features: [
          { title: "Single-tenant hardware", desc: "An entire physical machine, dedicated to you alone." },
          { title: "Offshore locations", desc: "Deployed in privacy-first, DMCA-ignored jurisdictions." },
          { title: "Crypto billing", desc: "Provision and renew from your prepaid crypto wallet." },
          { title: "Full root access", desc: "Bring your own OS and run anything, no restrictions." },
        ],
      },
      {
        slug: "ai-agents", name: "AI Agents", status: "soon", to: "/products/ai-agents", icon: LuBot,
        blurb: "Deploy autonomous agents & GPUs",
        summary: "Run autonomous AI agents and GPU workloads on private, offshore infrastructure that keeps your data yours.",
        features: [
          { title: "GPU compute", desc: "On-demand accelerators for inference and agent workloads." },
          { title: "Private by default", desc: "No data mining, no KYC \u2014 your prompts stay private." },
          { title: "One-click agents", desc: "Deploy popular agent frameworks in a click." },
          { title: "Pay with crypto", desc: "Usage billed straight to your wallet." },
        ],
      },
    ],
  },
  {
    key: "app-platform",
    label: "App Platform",
    desc: "Ship apps, not servers",
    items: [
      {
        slug: "app-platform", name: "App Platform", status: "soon", to: "/products/app-platform", icon: LuLayers,
        blurb: "One-click deploy from Git",
        summary: "Push to Git and we build, deploy and scale your app \u2014 no servers to manage, offshore by default.",
        features: [
          { title: "Deploy from Git", desc: "Connect a repo and ship on every push." },
          { title: "Autoscaling", desc: "Scale up under load, down when quiet \u2014 automatically." },
          { title: "Zero server ops", desc: "We handle the runtime, patching and TLS." },
          { title: "Offshore & private", desc: "Runs in DMCA-ignored regions, no KYC." },
        ],
      },
      {
        slug: "managed-kubernetes", name: "Managed Kubernetes", status: "soon", to: "/products/managed-kubernetes", icon: LuBoxes,
        blurb: "Production K8s without the ops",
        summary: "Production-grade Kubernetes clusters, fully managed \u2014 you get the control plane, we handle the toil.",
        features: [
          { title: "Managed control plane", desc: "Highly available, upgraded and monitored for you." },
          { title: "One-click node pools", desc: "Scale worker nodes up and down on demand." },
          { title: "Bring your workloads", desc: "Standard, upstream Kubernetes \u2014 no lock-in." },
          { title: "Crypto billing", desc: "Clusters billed to your prepaid wallet." },
        ],
      },
      {
        slug: "cpanel-hosting", name: "cPanel Hosting", status: "live", to: "/hosting", icon: LuServer,
        blurb: "Anti-red, DMCA-ignored hosting",
        summary: "Offshore cPanel hosting with anti-red protection and a prepaid crypto wallet.",
      },
    ],
  },
  {
    key: "data-storage",
    label: "Data & Storage",
    desc: "Durable, private data",
    items: [
      {
        slug: "managed-databases", name: "Managed Databases", status: "soon", to: "/products/managed-databases", icon: LuDatabase,
        blurb: "Postgres, MySQL & Redis, managed",
        summary: "Fully managed PostgreSQL, MySQL and Redis with automated backups, failover and encryption \u2014 offshore.",
        features: [
          { title: "Automated backups", desc: "Point-in-time recovery without lifting a finger." },
          { title: "High availability", desc: "Optional replicas with automatic failover." },
          { title: "Encrypted at rest", desc: "Your data encrypted, in privacy-first regions." },
          { title: "One-click scaling", desc: "Resize compute and storage on demand." },
        ],
      },
      {
        slug: "object-storage", name: "Object Storage", status: "soon", to: "/products/object-storage", icon: LuBoxes,
        blurb: "S3-compatible private buckets",
        summary: "S3-compatible object storage for backups, media and static sites \u2014 durable, private and crypto-billed.",
        features: [
          { title: "S3-compatible API", desc: "Works with the tools and SDKs you already use." },
          { title: "Unlimited buckets", desc: "Organise data however you like." },
          { title: "Private by default", desc: "Fine-grained access, offshore storage." },
          { title: "Pay with crypto", desc: "Storage billed to your wallet, no card needed." },
        ],
      },
      {
        slug: "block-storage", name: "Block Storage", status: "soon", to: "/products/block-storage", icon: LuHardDrive,
        blurb: "Fast NVMe volumes for servers",
        summary: "Attach fast, resizable NVMe block volumes to your cloud servers for databases and heavy workloads.",
        features: [
          { title: "NVMe performance", desc: "Low-latency volumes for demanding workloads." },
          { title: "Resize live", desc: "Grow volumes without downtime." },
          { title: "Snapshots", desc: "Point-in-time snapshots for safe backups." },
          { title: "Attach anywhere", desc: "Move volumes between your servers." },
        ],
      },
    ],
  },
  {
    key: "network",
    label: "Orchestration & Network",
    desc: "Route, balance, resolve",
    items: [
      {
        slug: "load-balancers", name: "Load Balancers", status: "soon", to: "/products/load-balancers", icon: LuScale,
        blurb: "Distribute traffic with health checks",
        summary: "Highly available load balancers that spread traffic across your servers with automatic health checks.",
        features: [
          { title: "Health checks", desc: "Unhealthy backends removed automatically." },
          { title: "TLS termination", desc: "Offload HTTPS with managed certificates." },
          { title: "Sticky sessions", desc: "Optional session affinity when you need it." },
          { title: "Crypto billing", desc: "Billed to your prepaid wallet." },
        ],
      },
      {
        slug: "domains", name: "Domains", status: "live", to: "/domains", icon: LuGlobe,
        blurb: "Private, no-KYC registration",
        summary: "Register domains privately with free WHOIS privacy and pay with crypto.",
      },
      {
        slug: "dns", name: "DNS", status: "live", to: "/dns-manager", icon: LuNetwork,
        blurb: "Fast, free managed DNS",
        summary: "Fast, reliable managed DNS with full record control.",
      },
      {
        slug: "developer-api", name: "Developer API", status: "live", to: "/api", icon: LuCode,
        blurb: "Automate everything via REST",
        summary: "Automate domains, DNS and servers with a clean REST API.",
      },
    ],
  },
];

export const ALL_PRODUCTS = PRODUCT_GROUPS.flatMap((g) =>
  g.items.map((it) => ({ ...it, group: g.label, groupKey: g.key }))
);

export const COMING_SOON = ALL_PRODUCTS.filter((p) => p.status === "soon");

export function getProductBySlug(slug) {
  return ALL_PRODUCTS.find((p) => p.slug === slug) || null;
}
