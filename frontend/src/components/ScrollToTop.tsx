import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * ScrollToTop ensures predictable page navigation and scroll positioning:
 * 1. For PUSH and REPLACE navigations (e.g. clicking cards, buttons, or links),
 *    resets the window scroll to top (0, 0) immediately, preventing stale scroll
 *    positions from pushing the new page content off-screen into the footer.
 * 2. For anchor hash navigation (e.g. #how, #resources, #faq, #camera),
 *    smoothly scrolls to the targeted element.
 * 3. For POP navigations (browser Back / Forward buttons), preserves native
 *    browser scroll restoration.
 */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    // If an anchor hash is present, scroll smoothly to the target element
    if (hash) {
      const targetId = hash.replace("#", "");
      const scrollToHash = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return true;
        }
        return false;
      };

      if (!scrollToHash()) {
        const timer = setTimeout(scrollToHash, 60);
        return () => clearTimeout(timer);
      }
      return;
    }

    // For standard page transitions (PUSH and REPLACE):
    // Reset window scroll position to the very top immediately.
    // If navType === "POP" (e.g. browser back/forward), allow native history restoration.
    if (navType !== "POP") {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant",
      });
    }
  }, [pathname, search, hash, navType]);

  return null;
}
