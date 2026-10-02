import { useEffect, useState } from "react";
import { Link } from "react-router";
import { brandAPI } from "../../../api/brand";
import { useAuth } from "../../../hooks/useAuth";

// Admin allowlist gate (backend-verified). Renders children only when allowed.
export default function BrandGate({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState("checking");

  useEffect(() => {
    let alive = true;
    brandAPI
      .access()
      .then((d) => alive && setState(d.allowed ? "ok" : "denied"))
      .catch(() => alive && setState("denied"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "ok") return children;

  return (
    <div className="hb flex min-h-screen items-center justify-center p-6">
      <div className="hb-win w-full max-w-lg" data-testid={state === "checking" ? "brand-gate-checking" : "brand-gate-denied"}>
        <div className="hb-win-bar">
          <span className="hb-dot" />
          <span className="hb-dot" />
          <span className="hb-dot" />
          <span className="ml-2">hosta.sh — brand</span>
        </div>
        <div className="hb-mono p-6 text-sm leading-7">
          <p>
            <span style={{ color: "var(--hb-prompt)" }}>~/brand</span> <span style={{ color: "var(--hb-ok)" }}>$</span> open README.md
          </p>
          {state === "checking" ? (
            <p className="hb-cursor" style={{ color: "var(--hb-muted)" }}>checking access</p>
          ) : (
            <>
              <p style={{ color: "#ff7b7b" }}>open: permission denied (403)</p>
              <p style={{ color: "var(--hb-muted)" }}>
                # this guide is restricted to brand admins.
                <br /># signed in as {user?.email || "unknown"}.
              </p>
              <p className="mt-4">
                <Link to="/" className="hb-btn" data-testid="brand-gate-home">
                  cd ~
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
