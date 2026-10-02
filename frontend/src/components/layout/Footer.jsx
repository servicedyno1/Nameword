import BrandLogo from "../common/BrandLogo";
import { FaBitcoin, FaEthereum } from "react-icons/fa6";
import { SiTether } from "react-icons/si";
import { LuMail, LuMapPin, LuShieldCheck } from "react-icons/lu";
import { NavLink, useNavigate, useLocation } from "react-router";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth } from "../../hooks/useAuth";
import { SUPPORT_EMAIL } from "../../config/brand";

const Footer = () => {
  const { t } = useLanguage();
  const s = t.site;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDomainSearch = (e) => {
    e.preventDefault();
    if (location.pathname === "/home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/home");
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
    }
  };

  // Signed-in destinations: remember where a guest wanted to go, then send them to sign in.
  const protectedTo = (path) => (user ? path : "/sign-in");
  const remember = (path) => () => { if (!user) localStorage.setItem("path", path); };

  const linkCls = "nw-link text-15 mb-3 block";
  const headCls = "mb-4 text-13 font-semibold uppercase tracking-wider text-primary dark:text-white";

  return (
    <footer className="border-t border-line bg-surface-2 dark:border-white/[0.06] dark:bg-gray-950">
      <div className="nw-container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2 flex flex-col items-start gap-6">
            <NavLink to="/" aria-label="hosta.sh home">
              <BrandLogo />
            </NavLink>
            <p className="max-w-sm text-15 text-ink-soft dark:text-gray-400">{s.footer.tagline}</p>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-15 text-ink-soft dark:text-gray-400">
                <LuMapPin className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {s.footer.jurisdictionNote}
              </span>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 text-15 text-ink-soft hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-300" data-testid="footer-support-email">
                <LuMail className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {SUPPORT_EMAIL}
              </a>
            </div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-13 font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
              data-testid="footer-dmca-badge"
            >
              <LuShieldCheck className="h-4 w-4" /> {s.footer.dmca}
            </span>
          </div>

          {/* Products */}
          <div>
            <p className={headCls}>{s.footer.products}</p>
            <a href="/home" onClick={handleDomainSearch} className={linkCls}>{s.footer.links.domains}</a>
            <NavLink to={protectedTo("/dns-manager")} onClick={remember("/dns-manager")} className={linkCls}>{s.footer.links.dns}</NavLink>
            <NavLink to="/hosting" className={linkCls}>{s.footer.links.hosting}</NavLink>
            <NavLink to="/vps" className={linkCls}>{s.footer.links.vps}</NavLink>
            <NavLink to="/rdp" className={linkCls}>{s.footer.links.rdp}</NavLink>
            <NavLink to="/api" className={linkCls}>{s.footer.links.api}</NavLink>
          </div>

          {/* Company */}
          <div>
            <p className={headCls}>{s.footer.company}</p>
            <NavLink to="/pricing" className={linkCls}>{s.footer.links.pricing}</NavLink>
            <NavLink to={protectedTo("/wallet")} onClick={remember("/wallet")} className={linkCls}>{s.footer.links.rewards}</NavLink>
            <NavLink to={protectedTo("/account-setting?tab=api-key")} onClick={remember("/account-setting?tab=api-key")} className={linkCls}>{s.footer.links.apiKeys}</NavLink>
            <NavLink to={protectedTo("/account-setting")} onClick={remember("/account-setting")} className={linkCls}>{s.footer.links.account}</NavLink>
          </div>

          {/* Support */}
          <div>
            <p className={headCls}>{s.footer.support}</p>
            <NavLink to="/help-support" className={linkCls}>{s.footer.links.help}</NavLink>
            <NavLink to="/help-support#discover-domains" className={linkCls}>{s.footer.links.faq}</NavLink>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={linkCls}>{s.footer.links.contact}</a>
            <NavLink to="/privacy-policy" className={linkCls}>{s.footer.links.privacy}</NavLink>
            <NavLink to="/terms-and-conditions" className={linkCls}>{s.footer.links.terms}</NavLink>
          </div>
        </div>

        <hr className="my-8 border-line dark:border-white/[0.06]" />

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p className="text-13 text-ink-soft dark:text-gray-500">© {new Date().getFullYear()} {s.footer.rights}</p>
          <div className="flex flex-wrap items-center gap-2" data-testid="footer-accepted-coins">
            <span className="text-13 text-ink-soft dark:text-gray-500">{s.footer.payments}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-13 font-medium text-ink-soft dark:border-white/10 dark:bg-gray-900 dark:text-gray-300" data-testid="footer-coin-btc" title="Bitcoin">
              <FaBitcoin className="h-4 w-4 text-[#f7931a]" /> BTC
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-13 font-medium text-ink-soft dark:border-white/10 dark:bg-gray-900 dark:text-gray-300" data-testid="footer-coin-eth" title="Ethereum">
              <FaEthereum className="h-4 w-4 text-[#627eea]" /> ETH
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-13 font-medium text-ink-soft dark:border-white/10 dark:bg-gray-900 dark:text-gray-300" data-testid="footer-coin-usdt" title="Tether (TRC-20)">
              <SiTether className="h-4 w-4 text-[#26a17b]" /> USDT-TRC20
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
