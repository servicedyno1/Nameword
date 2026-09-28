import { Routes, Route, useLocation } from "react-router";

import CreateAccount from "../pages/auth/CreateAccount";
import SignIn from "../pages/auth/SignIn";
import ResetPassword from "../pages/auth/ResetPassword";
import OtpCode from "../pages/auth/OtpCode";
import ChangeEmail from "../pages/auth/ChangeEmail";

import AuthLayout from "../layouts/AuthLayout";
import { Navigate } from "react-router";
import ForgotPassword from "../pages/auth/ForgotPassword";

import CheckoutLayout from "../layouts/CheckoutLayout";
import HostingUpsell from "../pages/checkout/HostingUpsell";
import AccountGate from "../pages/checkout/AccountGate";
import CartPage from "../pages/checkout/CartPage";
import OrderSuccess from "../pages/checkout/OrderSuccess";
import Hosting from "../pages/HostingNomadly";
import VPS from "../pages/VPS";
import RDP from "../pages/RDP";
import Api from "../pages/Api";
import ApiDocs from "../pages/ApiDocs";
import Pricing from "../pages/Pricing";
import DomainsNomadly from "../pages/DomainsNomadly";
import DnsManagerNomadly from "../pages/DnsManagerNomadly";
import ProtectedRoute from "../hocs/Protected";
import UnprotectedRoute from "../hocs/UnProtected";
import { useAuth } from "../hooks/useAuth";

/* front admin section */
import Dashboard from "../pages/front-admin/dashboard";

import PaymentHistory from "../pages/front-admin/billing/PaymentHistory";
import OrderHistory from "../pages/front-admin/OrderHistory";
import ServicesRenewals from "../pages/front-admin/ServicesRenewals";
import Wallet from "../pages/front-admin/billing/Wallet";

import AccountSettings from "../pages/front-admin/UserManagement/AccountSettings";
import HelpSupport from "../pages/front-admin/HelpSupport";
import FrontLayout from "../layouts/FrontLayout";
import TwoFactorLogin from "../pages/auth/TwoFactorLogin";
import { DomainProvider } from "../context/DomainContext";
import HomePage from "../pages/HomePage";
import ProductsIndex from "../pages/products/ProductsIndex";
import ComingSoonPage from "../pages/products/ComingSoonPage";
import TermsAndConditions from "../pages/TermsAndConditions";
import PrivacyPolicy from "../pages/PrivacyPolicy";

const IsEmailVerified = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const email = localStorage.getItem("email");
  // Allow EITHER a mid-signup guest (localStorage "email" set) OR an authenticated
  // but still-unverified user (soft gate: they tapped "Enter code" in the banner).
  if (!email && !isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }
  return children;
};

const IsQrCode = ({ children }) => {
  const qrCode = localStorage.getItem("qrCode");
  if (!qrCode) {
    return <Navigate to="/sign-in" replace />;
  }
  return children;
};

// Legacy domain routes (/home, /domain) were replaced by the /domains hub.
// Redirect while preserving any ?value= / ?q= query so the search still runs.
function LegacyDomainRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/domains${search}`} replace />;
}

function Router() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        element={
          <UnprotectedRoute>
            <AuthLayout />
          </UnprotectedRoute>
        }
      >
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/password-reset/:token" element={<ResetPassword />} />
        <Route
          path="/2fa/verify"
          element={
            <IsQrCode>
              <TwoFactorLogin />
            </IsQrCode>
          }
        />
        <Route path="/change-email" element={<ChangeEmail />} />
      </Route>

      {/* OTP is reachable by BOTH a mid-signup guest AND an authenticated-but-
          unverified user (soft gate), so it is NOT inside UnprotectedRoute. */}
      <Route element={<AuthLayout />}>
        <Route
          path="/otp-code"
          element={
            <IsEmailVerified>
              <OtpCode />
            </IsEmailVerified>
          }
        />
      </Route>

      <Route path="/home" element={<LegacyDomainRedirect />} />
      <Route path="/domain" element={<LegacyDomainRedirect />} />
      <Route path="/hosting" element={<Hosting />} />
      <Route path="/domains" element={<DomainsNomadly />} />
      <Route
        path="/dns-manager"
        element={
          <ProtectedRoute>
            <DnsManagerNomadly />
          </ProtectedRoute>
        }
      />
      <Route path="/vps" element={<VPS />} />
      <Route path="/rdp" element={<RDP />} />
      <Route path="/api" element={<Api />} />
      <Route path="/api-docs" element={<ApiDocs />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/products" element={<ProductsIndex />} />
      <Route path="/products/:slug" element={<ComingSoonPage />} />

      {/* Hostinger-style checkout funnel: search -> hosting -> account -> cart -> receipt */}
      <Route element={<CheckoutLayout />}>
        <Route path="/checkout/hosting" element={<HostingUpsell />} />
        <Route path="/checkout/account" element={<AccountGate />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout/success/:id" element={<OrderSuccess />} />
      </Route>
      <Route path="/upsell-checkout" element={<Navigate to="/cart" replace />} />
      <Route path="/payment-checkout" element={<Navigate to="/cart" replace />} />

      <Route
        element={
          <ProtectedRoute>
            <DomainProvider>
              <FrontLayout />
            </DomainProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/account-setting" element={<AccountSettings />} />
        <Route path="/payment-history" element={<PaymentHistory />} />
        <Route path="/orders" element={<OrderHistory />} />
        <Route path="/services" element={<ServicesRenewals />} />
        <Route path="/subscriptions" element={<Navigate to="/services" replace />} />
        <Route path="/wallet" element={<Wallet />} />
      </Route>
      <Route path="/help-support" element={<HelpSupport />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="*" element={<Navigate to={"/"} replace />} />
    </Routes>
  );
}

export default Router;
