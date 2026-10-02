import { useEffect } from "react";
import { Link } from "react-router";
import "./brand.css";
import { DecisionsProvider } from "./DecisionsContext";
import BrandGate from "./components/BrandGate";
import Sidebar from "./components/Sidebar";
import Readme from "./components/Readme";
import Snapshot from "./components/Snapshot";
import MarketScan from "./components/MarketScan";
import Personas from "./components/Personas";
import Personality from "./components/Personality";
import ColourDirections from "./components/ColourDirections";
import Typography from "./components/Typography";
import LogoConcepts from "./components/LogoConcepts";
import Decisions from "./components/Decisions";
import NextSteps from "./components/NextSteps";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Geist:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap";

// Loads the candidate typefaces for THIS page only (never touches the global app fonts).
function useGuideFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-hosta-fonts]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    link.setAttribute("data-hosta-fonts", "1");
    document.head.appendChild(link);
  }, []);
}

function Guide() {
  useGuideFonts();
  useEffect(() => {
    const prev = document.title;
    document.title = "hosta.sh — brand guide (private)";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="hb" data-testid="brand-guide">
      <header className="sticky top-0 z-20 border-b backdrop-blur-md" style={{ borderColor: "var(--hb-line)", background: "rgba(7,8,10,.75)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
          <div className="hb-mono flex items-center gap-2 text-sm">
            <span style={{ color: "var(--hb-ok)" }}>●</span>
            <span style={{ color: "var(--hb-text-strong)" }}>hosta.sh</span>
            <span style={{ color: "var(--hb-dim)" }}>/ brand-guide</span>
            <span className="hb-tag warn hidden sm:inline-flex">private</span>
          </div>
          <Link to="/dashboard" className="hb-btn" data-testid="brand-exit">
            exit
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-5 pb-24 pt-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 lg:px-8">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <Sidebar />
        </aside>
        <main className="min-w-0">
          <Readme />
          <Snapshot />
          <MarketScan />
          <Personas />
          <Personality />
          <ColourDirections />
          <Typography />
          <LogoConcepts />
          <Decisions />
          <NextSteps />
        </main>
      </div>
    </div>
  );
}

export default function BrandGuide() {
  return (
    <BrandGate>
      <DecisionsProvider>
        <Guide />
      </DecisionsProvider>
    </BrandGate>
  );
}
