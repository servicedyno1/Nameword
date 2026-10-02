import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { FiArrowRight, FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { usePageMeta } from "../../hooks/usePageMeta";
import { google } from "../../components/common/icons";
import CartSummary from "../../components/checkout/CartSummary";
import Loader from "../../components/common/Loader";
import { getStoredRef } from "../../utils/referral";

const RETURN_PATH = "/cart";

function PasswordInput({ id, value, onChange, placeholder, autoComplete, testId }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={8}
        className="nw-input pr-11"
        data-testid={testId}
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-primary dark:hover:text-white">
        {show ? <FiEyeOff size={18} /> : <FiEye size={18} />}
      </button>
    </div>
  );
}

// Hostinger-style account gate between the hosting step and the cart.
export default function AccountGate() {
  usePageMeta("Your account", "Sign in or create an account to complete your order.");
  const { isAuthenticated, loading, login, register, error, clearError } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    clearError?.();
    setLocalError(null);
  }, [tab, clearError]);

  if (loading) return <Loader />;
  if (isAuthenticated) return <Navigate to={RETURN_PATH} replace />;
  if (cart.isEmpty) return <Navigate to="/domains" replace />;

  const submitLogin = async (e) => {
    e.preventDefault();
    // Autofill-proof: read live DOM values (browser autofill may not update React state).
    const emailVal = (document.getElementById("gate-email")?.value || email || "").trim();
    const passwordVal = document.getElementById("gate-password")?.value || password || "";
    setEmail(emailVal);
    setPassword(passwordVal);
    if (!emailVal || !passwordVal) {
      setLocalError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      localStorage.setItem("path", RETURN_PATH);
      await login({ email: emailVal, password: passwordVal });
    } catch {
      /* error surfaced via context */
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    // Autofill-proof: read live DOM values (browser autofill may not update React state).
    const emailVal = (document.getElementById("gate-email")?.value || email || "").trim();
    const passwordVal = document.getElementById("gate-password")?.value || password || "";
    const confirmVal = document.getElementById("gate-confirm")?.value || confirm || "";
    setEmail(emailVal);
    setPassword(passwordVal);
    setConfirm(confirmVal);
    if (!emailVal || !passwordVal) {
      setLocalError("Please enter your email and password.");
      return;
    }
    if (passwordVal !== confirmVal) {
      setLocalError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      localStorage.setItem("path", RETURN_PATH);
      const res = await register({ email: emailVal, password: passwordVal, passwordConfirmation: confirmVal });
      if (res?.token) navigate(RETURN_PATH, { replace: true });
      else navigate("/otp-code", { replace: true });
    } catch {
      /* error surfaced via context */
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = () => {
    localStorage.setItem("path", RETURN_PATH);
    const ref = getStoredRef();
    const base = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
    window.location.href = ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
  };

  const shownError = localError || error;
  const tabCls = (k) =>
    `flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${tab === k ? "bg-white dark:bg-gray-900 text-primary dark:text-white shadow-sm" : "text-ink-soft dark:text-gray-400 hover:text-primary dark:hover:text-white"}`;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]" data-testid="account-gate-page">
      <section className="max-w-xl">
        <span className="nw-eyebrow mb-4">Step 3 · Account</span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary dark:text-white">Almost there — who is this order for?</h1>
        <p className="mt-3 nw-lead">Sign in to your hosta.sh account or create one in seconds. Your cart is saved on this device.</p>

        <div className="nw-card mt-8 !p-6 sm:!p-8">
          <div className="flex rounded-xl bg-surface-2 dark:bg-gray-800 p-1" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "login"} onClick={() => setTab("login")} className={tabCls("login")} data-testid="account-tab-login">
              Log in
            </button>
            <button type="button" role="tab" aria-selected={tab === "register"} onClick={() => setTab("register")} className={tabCls("register")} data-testid="account-tab-register">
              Create account
            </button>
          </div>

          {shownError && (
            <div className="mt-5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert" data-testid="account-error">
              {shownError}
            </div>
          )}

          <form onSubmit={tab === "login" ? submitLogin : submitRegister} className="mt-6 space-y-4" data-testid={`account-form-${tab}`}>
            <div>
              <label htmlFor="gate-email" className="block text-sm font-medium text-primary dark:text-white mb-1.5">Email</label>
              <input id="gate-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required className="nw-input" data-testid="account-email-input" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="gate-password" className="block text-sm font-medium text-primary dark:text-white">Password</label>
                {tab === "login" && (
                  <Link to="/forgot-password" className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline">Forgot password?</Link>
                )}
              </div>
              <PasswordInput id="gate-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tab === "login" ? "Your password" : "At least 8 characters"} autoComplete={tab === "login" ? "current-password" : "new-password"} testId="account-password-input" />
            </div>
            {tab === "register" && (
              <div>
                <label htmlFor="gate-confirm" className="block text-sm font-medium text-primary dark:text-white mb-1.5">Confirm password</label>
                <PasswordInput id="gate-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" autoComplete="new-password" testId="account-confirm-input" />
              </div>
            )}
            <button type="submit" disabled={busy} className="nw-btn-primary w-full disabled:opacity-60" data-testid="account-submit-button">
              {busy ? "Please wait…" : tab === "login" ? "Log in and continue" : "Create account and continue"} <FiArrowRight size={16} />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-ink-muted">
            <span className="h-px flex-1 bg-line dark:bg-gray-800" /> or <span className="h-px flex-1 bg-line dark:bg-gray-800" />
          </div>
          <button type="button" onClick={googleLogin} className="nw-btn-secondary w-full" data-testid="account-google-button">
            <img src={google} alt="" className="h-5 w-5" /> Continue with Google
          </button>

          <p className="mt-6 flex items-center gap-2 text-xs text-ink-soft dark:text-gray-400">
            <FiLock size={13} /> Secured checkout. We never share your details.
          </p>
        </div>
      </section>

      <CartSummary items={cart.items} />
    </div>
  );
}
