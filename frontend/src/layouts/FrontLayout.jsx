import AppSidebar from "../components/front-admin/admin-common/AppSidebar";
import CommandPalette from "../components/common/CommandPalette";
import VerifyEmailBanner from "../components/common/VerifyEmailBanner";
import RebrandNotice from "../components/common/RebrandNotice";
import { Outlet, NavLink, useLocation } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { CgMenu } from "react-icons/cg";
import { LuSearch, LuWallet, LuBell, LuCheck, LuGift, LuLayoutDashboard, LuGlobe, LuServer, LuUser } from "react-icons/lu";
import { IoChevronDown } from "react-icons/io5";
import { favicon, USA, ES, FR } from "../components/common/icons";
import ThemeToggleButton from "../components/common/ThemeToggleButton";
import UserDropdownMenu from "../components/common/UserDropdownMenu";
import CartNavButton from "../components/checkout/CartNavButton";
import useDropdown from "../hooks/useDropdown";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { walletAPI } from "../api/walletApi";

const BOTTOM_TABS = [
  { key: "home", to: "/dashboard", icon: LuLayoutDashboard },
  { key: "domains", to: "/domains", icon: LuGlobe },
  { key: "hosting", to: "/hosting", icon: LuServer },
  { key: "wallet", to: "/wallet", icon: LuWallet },
  { key: "account", to: "/account-setting", icon: LuUser },
];

const LANGS = ["en", "es", "fr"];
const flag = (lang) => (lang === "es" ? ES : lang === "fr" ? FR : USA);

const FrontLayout = ({ children, fluid = false }) => {
  const { user, refreshUser } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const languageDropDown = useDropdown();
  const notifDropDown = useDropdown();
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("nw_sidebar_collapsed") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [balance, setBalance] = useState(null);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("nw_sidebar_collapsed", !c ? "1" : "0");
      return !c;
    });
  };

  // Cmd/Ctrl + K or "/" opens the command palette
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const typing =
        el &&
        (["input", "textarea", "select"].includes((el.tagName || "").toLowerCase()) || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const fetchBalance = useCallback(() => {
    if (!user) { setBalance(null); return; }
    walletAPI.getWallet()
      .then((res) => {
        const b = res?.data?.balance;
        setBalance(Number(b?.USD ?? b?.default ?? 0));
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => { fetchBalance(); }, [fetchBalance, pathname]);

  useEffect(() => {
    const onWallet = () => { fetchBalance(); refreshUser?.(); };
    window.addEventListener("wallet:updated", onWallet);
    return () => window.removeEventListener("wallet:updated", onWallet);
  }, [fetchBalance, refreshUser]);

  const handleLanguageChange = (lang) => { changeLanguage(lang); languageDropDown.close(); };
  const app = t.site.app;

  const mobileLangRow = (
    <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 dark:border-white/[0.06]" data-testid="sidebar-language-row">
      {LANGS.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => changeLanguage(lng)}
          className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-13 font-semibold uppercase ${language === lng ? "border-brand bg-brand-50 text-brand-700 dark:bg-brand/15 dark:text-brand-300" : "border-line text-ink-soft dark:border-gray-700 dark:text-gray-300"}`}
          aria-pressed={language === lng}
        >
          <img src={flag(lng)} alt="" className="h-3 w-5 object-cover" />{lng}
        </button>
      ))}
    </div>
  );

  return (
    <div className="nw-app-bg flex h-screen overflow-hidden">
      {/* Desktop sidebar (single smart sidebar: expanded or icon rail) */}
      <aside className={`hidden shrink-0 lg:flex transition-[width] duration-200 ${collapsed ? "w-[76px]" : "w-[248px]"}`} data-testid="desktop-sidebar">
        <AppSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-white/85 px-3 backdrop-blur-md dark:border-white/[0.06] dark:bg-gray-950/85 sm:gap-3 sm:px-4 lg:px-6">
          <button className="header-icon-btn lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)} data-testid="mobile-menu-button">
            <CgMenu size={22} />
          </button>
          <NavLink to="/dashboard" className="lg:hidden"><img src={favicon} alt="hosta.sh" className="h-8 w-8" /></NavLink>

          <button
            onClick={() => setPaletteOpen(true)}
            className="group hidden w-full max-w-sm items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-ink-soft transition-colors hover:border-brand/40 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:border-brand/40 sm:flex"
            data-testid="global-search"
          >
            <LuSearch className="h-4 w-4" />
            <span className="text-15">{app.searchPlaceholder}</span>
            <kbd className="ml-auto rounded border border-line bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft dark:border-gray-700 dark:bg-gray-800">/</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button onClick={() => setPaletteOpen(true)} className="header-icon-btn sm:hidden" aria-label="Search" data-testid="global-search-mobile"><LuSearch className="h-5 w-5" /></button>

            <NavLink to="/wallet#rewards" title={app.rewards} data-testid="rewards-chip" className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-13 font-semibold text-primary dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 md:inline-flex">
              <LuGift className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {Number(user?.rewardPoints ?? 0)} <span className="hidden sm:inline">{app.pts}</span>
            </NavLink>

            <NavLink to="/wallet" title={app.wallet} data-testid="wallet-chip" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-13 font-semibold text-brand-700 dark:bg-brand/15 dark:text-brand-300 lg:h-9">
              <LuWallet className="h-4 w-4" /> {balance == null ? "—" : `$${balance.toFixed(2)}`}
            </NavLink>

            <div ref={notifDropDown.ref} className="relative">
              <button onClick={notifDropDown.toggle} className={`header-icon-btn transition-colors ${notifDropDown.isOpen ? "bg-brand-50 text-brand-600 dark:bg-brand/15 dark:text-brand-300" : ""}`} aria-label="Notifications" data-testid="notifications-button"><LuBell className="h-5 w-5" /></button>
              {notifDropDown.isOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-xl dark:border-white/[0.08] dark:bg-gray-900 nw-rise">
                  <div className="flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-brand-50 to-fuchsia-50/60 px-4 py-3 dark:border-white/[0.06] dark:from-brand/12 dark:to-fuchsia-500/[0.06]">
                    <span className="nw-stat-chip nw-grad-brand h-8 w-8"><LuBell className="h-4 w-4" /></span>
                    <p className="text-sm font-semibold text-primary dark:text-white">{app.notifications}</p>
                  </div>
                  <div className="flex flex-col items-center px-4 py-8 text-center">
                    <div className="relative mb-3 nw-floaty">
                      <div className="absolute -inset-2 -z-10 rounded-full bg-gradient-to-tr from-emerald-300 to-emerald-500 opacity-60 blur-xl dark:from-emerald-500/30 dark:to-emerald-600/20" aria-hidden="true" />
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white shadow-sm dark:border-white/[0.1] dark:bg-gray-900">
                        <LuCheck className="h-6 w-6 text-emerald-500" />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-primary dark:text-white">{app.allCaughtUp}</p>
                  </div>
                </div>
              )}
            </div>

            <div ref={languageDropDown.ref} className="relative hidden lg:block">
              <button onClick={languageDropDown.toggle} type="button" className="language-menu" data-testid="language-menu">
                <img src={flag(language)} alt={language.toUpperCase()} className="h-3 w-5 object-cover object-center" />
                <p>{language.toUpperCase()}</p>
                <IoChevronDown />
              </button>
              {languageDropDown.isOpen && (
                <div className="dropdown">
                  {LANGS.map((lng) => (
                    <button key={lng} onClick={() => handleLanguageChange(lng)} className="dropdown-menu w-full text-left">
                      <img src={flag(lng)} alt={lng} className="h-3 w-5 object-cover object-center" />
                      <span>{lng.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ThemeToggleButton />
            <CartNavButton />
            <div className="hidden sm:block"><UserDropdownMenu showQuickLinks={false} /></div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <VerifyEmailBanner />
          <RebrandNotice />
          {fluid ? (children ?? <Outlet />) : <div className="main-content">{children ?? <Outlet />}</div>}
          <div className="mt-8 flex flex-col gap-3 px-4 pb-6 text-13 font-medium text-ink-soft lg:px-10">
            <div className="flex gap-4">
              <NavLink to="/terms-and-conditions" className="nw-link">{t.footer.termsAndConditions}</NavLink>
              <NavLink to="/privacy-policy" className="nw-link">{t.footer.privacyPolicy}</NavLink>
            </div>
            <p>{new Date().getFullYear()} {t.footer.allRightsReserved}</p>
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="mobile-drawer">
          <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[86%] max-w-xs flex-col bg-white shadow-2xl dark:border-r dark:border-white/[0.06] dark:bg-gray-950">
            <AppSidebar
              collapsed={false}
              onClose={() => setMobileOpen(false)}
              footer={
                <div>
                  <div className="border-t border-line pt-4 dark:border-white/[0.06]"><UserDropdownMenu showQuickLinks={false} /></div>
                  {mobileLangRow}
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 z-30 flex w-full items-center justify-around border-t border-line bg-white/95 px-2 py-1.5 backdrop-blur lg:hidden dark:border-white/[0.06] dark:bg-gray-950/95" data-testid="bottom-tabs">
        {BOTTOM_TABS.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(tab.to);
          return (
            <NavLink key={tab.to} to={tab.to} className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[11px] font-medium ${active ? "text-brand-700 dark:text-brand-300" : "text-ink-soft dark:text-gray-400"}`} data-testid={`bottom-tab-${tab.key}`}>
              <tab.icon className="h-5 w-5" />
              {app.tabs[tab.key]}
            </NavLink>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

export default FrontLayout;
