import { useEffect, useState } from "react";
import { TREE } from "../brandData";

const IDS = TREE.map((t) => t.id);

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

export default function Sidebar() {
  const active = useActiveSection(IDS);
  return (
    <nav aria-label="Brand guide sections" data-testid="brand-sidebar" className="hb-tree min-w-0 max-w-full">
      <div className="hb-cmd mb-3 !text-xs">
        <span className="dollar">$</span>
        <span className="text">tree ./brand</span>
      </div>
      <div className="hb-comment mb-1 text-xs">.</div>
      <div className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {TREE.map((t, i) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            data-testid={`brand-nav-${t.id}`}
            className={active === t.id ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className="hidden lg:inline" style={{ color: "var(--hb-dim)" }}>
              {i === TREE.length - 1 ? "└── " : "├── "}
            </span>
            {t.file}
          </a>
        ))}
      </div>
    </nav>
  );
}
