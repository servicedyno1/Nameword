import { useEffect } from "react";

/**
 * Sets document.title and the meta description for a page.
 * Title format: "<page> · hosta.sh" (or the brand default when no page title is given).
 */
export function usePageMeta(title, description) {
  useEffect(() => {
    const brand = "hosta.sh";
    document.title = title ? `${title} · ${brand}` : `${brand} — Private by default. Scriptable by design.`;
    if (description) {
      let el = document.querySelector('meta[name="description"]');
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", "description");
        document.head.appendChild(el);
      }
      el.setAttribute("content", description);
      const og = document.querySelector('meta[property="og:description"]');
      if (og) og.setAttribute("content", description);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", document.title);
  }, [title, description]);
}

export default usePageMeta;
