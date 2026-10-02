import { Outlet } from 'react-router';
import { LuShieldCheck, LuGlobe, LuWallet } from 'react-icons/lu';
import AuthNavbar from '../components/layout/AuthNavbar';
import AuthFooter from '../components/layout/AuthFooter';
import BrandLogo from '../components/common/BrandLogo';
import { useLanguage } from '../hooks/useLanguage';

const AuthLayout = () => {
  const { t } = useLanguage();
  const a = t?.site?.auth || {};

  const features = [
    { icon: LuShieldCheck, label: a.featurePrivacy || 'Private WHOIS on every eligible domain' },
    { icon: LuGlobe, label: a.featureOffshore || 'Offshore & DMCA-ignored infrastructure' },
    { icon: LuWallet, label: a.featureWallet || 'Prepaid crypto wallet — no card on file' },
  ];

  return (
    <div className="nw-app-bg min-h-screen w-full lg:grid lg:grid-cols-2 xl:grid-cols-[1.1fr_1fr]">
      {/* Left brand showcase — desktop only */}
      <aside
        className="auth-brand-panel relative hidden overflow-hidden p-12 xl:p-16 lg:flex lg:flex-col lg:justify-between"
        data-testid="auth-brand-panel"
      >
        <div className="absolute inset-0 nw-grid-bg opacity-[0.12]" />

        <div className="relative z-10 flex items-center gap-2.5">
          <BrandLogo tone="onDark" markClassName="h-9 w-9" textClassName="text-[1.35rem]" />
        </div>

        <div className="relative z-10 max-w-md">
          <p className="hs-prompt text-white/75 dark:text-white/75">
            <span className="hs-prompt-sign text-[#22E6FF] dark:text-[#22E6FF]">$</span>
            <span>hosta up --offshore --private --no-kyc</span>
            <span className="hs-cursor" aria-hidden="true" />
          </p>
          <h2 className="mt-5 font-mono text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-white xl:text-[2.75rem]">
            {a.brandHeadline || 'Private by default. Scriptable by design.'}
          </h2>
          <p className="mt-5 max-w-sm text-white/80">
            {a.brandSub || 'Domains, DNS, cPanel hosting, VPS & RDP from privacy-first jurisdictions — paid from a prepaid crypto wallet. No card stored, minimal logs.'}
          </p>
          <ul className="mt-9 space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 backdrop-blur">
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-white/55">
          {a.brandFooter || 'Trusted for offshore domains & hosting.'}
        </p>
      </aside>

      {/* Right side — navbar + form + footer */}
      <div className="flex min-h-screen flex-col">
        <AuthNavbar />
        <div className="flex-1">
          <Outlet />
        </div>
        <AuthFooter />
      </div>
    </div>
  );
};

export default AuthLayout;
