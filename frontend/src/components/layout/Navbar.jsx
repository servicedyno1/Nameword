import { useState } from "react";
import { createPortal } from "react-dom";
import { USA, ES, FR } from "../common/icons";
import BrandLogo from "../common/BrandLogo";
import useDropdown from "../../hooks/useDropdown";
import { useAuth } from "../../hooks/useAuth";
import { NavLink, useNavigate } from "react-router";
import { IoChevronDown, IoMenu } from "react-icons/io5";
import { RxCross2 } from "react-icons/rx";
import { LuShieldCheck, LuClock, LuArrowRight } from "react-icons/lu";
import { PRODUCT_GROUPS } from "../../data/productCatalog";
import ThemeToggleButton from "../common/ThemeToggleButton";
import UserDropdownMenu from "../common/UserDropdownMenu";
import CartNavButton from "../checkout/CartNavButton";
import { useLanguage } from "../../hooks/useLanguage";

// Product taxonomy lives in ../../data/productCatalog (single source of truth).

const Navbar = () => {
  const languageDropDown = useDropdown();
  const productsDropDown = useDropdown();
  const { user } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const s = t.site;

  const flag = (lang) => (lang === "es" ? ES : lang === "fr" ? FR : USA);
  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    languageDropDown.close();
  };

  const goPricing = (e) => {
    e.preventDefault();
    setMobileOpen(false);
    navigate("/pricing");
  };

  const deskLink =
    "rounded-lg px-3 py-2 text-15 font-medium text-primary hover:bg-surface-2 dark:text-gray-200 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line/80 bg-white/85 backdrop-blur-md dark:border-white/[0.06] dark:bg-gray-950/80">
      <div className="nw-container flex h-16 lg:h-[4.5rem] items-center justify-between gap-4">
        {/* Brand */}
        <NavLink to={user ? "/dashboard" : "/"} className="flex items-center gap-2 shrink-0" aria-label="hosta.sh home">
          <BrandLogo markClassName="h-8 w-8" />
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          <div ref={productsDropDown.ref} className="relative">
            <button
              type="button"
              onClick={productsDropDown.toggle}
              aria-haspopup="true"
              aria-expanded={productsDropDown.isOpen}
              className={`flex items-center gap-1.5 ${deskLink}`}
            >
              {s.nav.products}
              <IoChevronDown className={`transition-transform ${productsDropDown.isOpen ? "rotate-180" : ""}`} />
            </button>
            {productsDropDown.isOpen && (
              <div className="absolute left-0 mt-2 w-[60rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-4 shadow-2xl dark:border-white/[0.08] dark:bg-gray-900 dark:shadow-black/60">
                <div className="grid grid-cols-4 gap-x-4 gap-y-1">
                  {PRODUCT_GROUPS.map((group) => (
                    <div key={group.key}>
                      <p className="px-2 pb-1.5 pt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted dark:text-gray-500">{group.label}</p>
                      {group.items.map((it) => (
                        <NavLink
                          key={it.slug}
                          to={it.to}
                          onClick={() => productsDropDown.close()}
                          className="flex items-start gap-2.5 rounded-xl p-2.5 hover:bg-surface-2 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <span className="nw-icon h-8 w-8 shrink-0"><it.icon className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-13 font-semibold text-primary dark:text-white">{it.name}</span>
                              {it.status === "soon" && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                  <LuClock className="h-2.5 w-2.5" />Soon
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-ink-soft dark:text-gray-400">{it.blurb}</span>
                          </span>
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-brand/15 bg-brand-50/70 px-3 py-2 text-13 text-brand-800 dark:border-brand/20 dark:bg-brand/10 dark:text-brand-200">
                  <span className="flex items-center gap-2"><LuShieldCheck className="h-4 w-4 shrink-0" />{s.home.heroChips.join(" · ")}</span>
                  <NavLink to="/products" onClick={() => productsDropDown.close()} className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline">All products <LuArrowRight className="h-3.5 w-3.5" /></NavLink>
                </div>
              </div>
            )}
          </div>
          <a href="/pricing" onClick={goPricing} className={deskLink}>{s.nav.pricing}</a>
          <NavLink to="/api" className={deskLink}>{s.nav.api}</NavLink>
          <NavLink to="/help-support" className={deskLink}>{s.nav.support}</NavLink>
        </nav>

        {/* Desktop right */}
        <div className="hidden lg:flex items-center gap-2">
          <div ref={languageDropDown.ref} className="relative">
            <button onClick={languageDropDown.toggle} type="button" className="language-menu">
              <img src={flag(language)} alt={language.toUpperCase()} title={language.toUpperCase()} className="w-5 h-3 object-cover object-center" />
              <p>{language.toUpperCase()}</p>
              <IoChevronDown />
            </button>
            {languageDropDown.isOpen && (
              <div className="dropdown">
                {["en", "es", "fr"].map((lng) => (
                  <button key={lng} onClick={() => handleLanguageChange(lng)} className="dropdown-menu w-full text-left">
                    <img src={flag(lng)} alt={lng.toUpperCase()} title={lng.toUpperCase()} className="w-5 h-3 object-cover object-center" />
                    <span>{lng.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ThemeToggleButton />
          <CartNavButton />
          {user ? (
            <>
              <NavLink to="/dashboard" className="nw-btn-primary nw-btn-sm" data-testid="nav-dashboard-btn">{s.nav.dashboard}</NavLink>
              <UserDropdownMenu classAdd={true} />
            </>
          ) : (
            <>
              <NavLink to="/sign-in" className="nw-btn-ghost nw-btn-sm">{s.nav.signIn}</NavLink>
              <NavLink to="/create-account" className="nw-btn-primary nw-btn-sm">{s.nav.createAccount}</NavLink>
            </>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggleButton />
          <CartNavButton />
          <button type="button" onClick={() => setMobileOpen(true)} aria-label={s.nav.openMenu} className="header-icon-btn h-11 w-11 text-primary dark:text-white" data-testid="nav-mobile-menu">
            <IoMenu size={26} />
          </button>
        </div>
      </div>

      {/* Mobile drawer — portaled to document.body so the header's
          backdrop-blur (which becomes a containing block for fixed children)
          can't clip/cover the full-screen overlay. */}
      {mobileOpen && createPortal(
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-white p-5 shadow-2xl dark:bg-gray-950 dark:border-l dark:border-white/[0.06]">
            <div className="mb-6 flex items-center justify-between">
              <BrandLogo markClassName="h-8 w-8" />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label={s.nav.closeMenu} className="header-icon-btn h-11 w-11 text-primary dark:text-white">
                <RxCross2 size={24} />
              </button>
            </div>

            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft dark:text-gray-500">{s.nav.products}</p>
            <div className="flex flex-col gap-4">
              {PRODUCT_GROUPS.map((group) => (
                <div key={group.key}>
                  <p className="px-1 pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted dark:text-gray-500">{group.label}</p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((it) => (
                      <NavLink key={it.slug} to={it.to} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2 dark:hover:bg-white/[0.05]">
                        <span className="nw-icon h-9 w-9 shrink-0"><it.icon className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-primary dark:text-white">{it.name}</span>
                            {it.status === "soon" && <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Soon</span>}
                          </span>
                          <span className="block truncate text-xs text-ink-soft dark:text-gray-400">{it.blurb}</span>
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              <NavLink to="/products" onClick={() => setMobileOpen(false)} className="mt-1 inline-flex items-center gap-1 px-1 text-13 font-semibold text-brand-700 dark:text-brand-300">All products <LuArrowRight className="h-3.5 w-3.5" /></NavLink>
            </div>

            <div className="my-4 border-t border-line dark:border-white/[0.06]" />
            <div className="flex flex-col gap-1">
              <a href="/pricing" onClick={goPricing} className="rounded-xl p-2.5 text-15 font-medium text-primary hover:bg-surface-2 dark:text-white dark:hover:bg-white/[0.05]">{s.nav.pricing}</a>
              <NavLink to="/api" onClick={() => setMobileOpen(false)} className="rounded-xl p-2.5 text-15 font-medium text-primary hover:bg-surface-2 dark:text-white dark:hover:bg-white/[0.05]">{s.nav.api}</NavLink>
              <NavLink to="/help-support" onClick={() => setMobileOpen(false)} className="rounded-xl p-2.5 text-15 font-medium text-primary hover:bg-surface-2 dark:text-white dark:hover:bg-white/[0.05]">{s.nav.support}</NavLink>
            </div>

            <div className="my-4 border-t border-line dark:border-white/[0.06]" />
            <div className="mb-4 flex items-center gap-2">
              {["en", "es", "fr"].map((lng) => (
                <button key={lng} onClick={() => handleLanguageChange(lng)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-13 font-medium uppercase ${language === lng ? "border-brand text-brand-700 dark:text-brand-300" : "border-line text-ink-soft dark:border-gray-700 dark:text-gray-300"}`}>
                  <img src={flag(lng)} alt={lng} className="w-5 h-3 object-cover" />{lng}
                </button>
              ))}
            </div>

            <div className="mt-auto">
              {user ? (
                <div className="flex flex-col gap-3">
                  <NavLink to="/dashboard" onClick={() => setMobileOpen(false)} className="nw-btn-primary w-full" data-testid="nav-dashboard-btn-mobile">{s.nav.dashboard}</NavLink>
                  <UserDropdownMenu classAdd={true} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <NavLink to="/sign-in" onClick={() => setMobileOpen(false)} className="nw-btn-secondary w-full">{s.nav.signIn}</NavLink>
                  <NavLink to="/create-account" onClick={() => setMobileOpen(false)} className="nw-btn-primary w-full">{s.nav.createAccount}</NavLink>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default Navbar;
