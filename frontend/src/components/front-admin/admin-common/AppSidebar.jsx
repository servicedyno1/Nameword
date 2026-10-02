import { NavLink, useLocation } from "react-router";
import {
  LuLayoutDashboard, LuGlobe, LuNetwork, LuServer, LuCloud, LuMonitor,
  LuWallet, LuReceipt, LuClock, LuHistory, LuGift, LuSettings, LuLifeBuoy,
  LuChevronsLeft, LuChevronsRight, LuX,
} from "react-icons/lu";
import BrandLogo from "../../common/BrandLogo";
import { useLanguage } from "../../../hooks/useLanguage";

// Single smart sidebar: one grouped navigation that collapses to an icon rail.
const GROUPS = [
  { key: null, items: [{ key: "overview", to: "/dashboard", icon: LuLayoutDashboard, match: ["/dashboard"] }] },
  {
    key: "products",
    items: [
      { key: "domains", to: "/domains", icon: LuGlobe, match: ["/domains"] },
      { key: "dns", to: "/dns-manager", icon: LuNetwork, match: ["/dns-manager"] },
      { key: "hosting", to: "/hosting", icon: LuServer, match: ["/hosting"] },
      { key: "vps", to: "/vps", icon: LuCloud, match: ["/vps"] },
      { key: "rdp", to: "/rdp", icon: LuMonitor, match: ["/rdp"] },
    ],
  },
  {
    key: "billing",
    items: [
      { key: "wallet", to: "/wallet", icon: LuWallet, match: ["/wallet"] },
      { key: "orders", to: "/orders", icon: LuReceipt, match: ["/orders"] },
      { key: "services", to: "/services", icon: LuClock, match: ["/services"] },
      { key: "payments", to: "/payment-history", icon: LuHistory, match: ["/payment-history"] },
      { key: "rewards", to: "/wallet#rewards", icon: LuGift, match: [] },
    ],
  },
  {
    key: "account",
    items: [
      { key: "settings", to: "/account-setting", icon: LuSettings, match: ["/account-setting", "/change-email"] },
      { key: "help", to: "/help-support", icon: LuLifeBuoy, match: ["/help-support"] },
    ],
  },
];

function Tip({ children }) {
  return (
    <span className="pointer-events-none absolute left-[54px] z-50 whitespace-nowrap rounded-md border border-white/10 bg-gray-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      {children}
    </span>
  );
}

export default function AppSidebar({ collapsed = false, onToggle, onClose, footer }) {
  const { pathname, hash } = useLocation();
  const { t } = useLanguage();
  const labels = t.site.app.rail;
  const groups = labels.groups || {};

  const isActive = (it) => {
    if (it.key === "rewards") return pathname === "/wallet" && hash === "#rewards";
    if (it.key === "wallet" && hash === "#rewards") return false;
    return it.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
  };

  const itemCls = (it) =>
    `group app-side-item ${collapsed ? "w-11 justify-center px-0" : ""} ${isActive(it) ? "app-side-item-active" : ""}`;

  return (
    <div
      className={`flex h-full w-full flex-col border-r border-line bg-white py-5 dark:border-white/[0.06] dark:bg-gray-950 ${collapsed ? "app-side-collapsed items-center px-3" : "px-4"}`}
      data-testid="app-sidebar"
    >
      <div className={`mb-6 flex items-center px-1 ${collapsed ? "justify-center" : "justify-between"}`}>
        <NavLink to="/dashboard" aria-label="hosta.sh" data-testid="sidebar-brand">
          <BrandLogo markClassName="h-8 w-8" showText={!collapsed} textClassName="text-[1.35rem]" />
        </NavLink>
        {onClose && (
          <button type="button" onClick={onClose} className="header-icon-btn" aria-label="Close menu" data-testid="sidebar-close">
            <LuX className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Primary">
        {GROUPS.map((g, gi) => (
          <div key={g.key || gi}>
            {g.key &&
              (collapsed ? (
                <div className="mx-auto mb-3 h-px w-8 bg-line dark:bg-white/[0.08]" aria-hidden="true" />
              ) : (
                <p className="app-side-group">{groups[g.key] || g.key}</p>
              ))}
            <ul className="space-y-1">
              {g.items.map((it) => (
                <li key={it.key}>
                  <NavLink
                    to={it.to}
                    title={labels[it.key]}
                    onClick={onClose}
                    aria-current={isActive(it) ? "page" : undefined}
                    className={itemCls(it)}
                    data-testid={`side-${it.key}`}
                  >
                    <it.icon className="h-5 w-5 shrink-0" />
                    {collapsed ? <Tip>{labels[it.key]}</Tip> : <span className="truncate">{labels[it.key]}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {footer}

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? labels.expand : labels.collapse}
          className={`group app-side-item mt-4 ${collapsed ? "w-11 justify-center px-0" : ""}`}
          data-testid="sidebar-toggle"
        >
          {collapsed ? (
            <>
              <LuChevronsRight className="h-5 w-5" />
              <Tip>{labels.expand}</Tip>
            </>
          ) : (
            <>
              <LuChevronsLeft className="h-5 w-5" />
              <span>{labels.collapse}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
