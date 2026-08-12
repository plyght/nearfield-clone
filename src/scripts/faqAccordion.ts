const EASING = "cubic-bezier(0.2, 0.7, 0.3, 1)";
const OPEN_MS = 280;
const CLOSE_MS = 240;

/**
 * Height-animates native <details> panels. The `open` attribute is only flipped
 * once the collapse animation finishes, so the body stays visible throughout.
 * With reduced motion the default instant toggle is left alone.
 */
export function initFaqAccordion(): void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll<HTMLDetailsElement>("[data-faq]").forEach((details) => {
    const summary = details.querySelector("summary");
    const body = details.querySelector<HTMLElement>("[data-faq-body]");
    if (!summary || !body) return;

    let animating = false;

    summary.addEventListener("click", (event) => {
      if (reducedMotion) return;
      event.preventDefault();
      if (animating) return;
      animating = true;

      const height = () => body.scrollHeight;

      if (details.open) {
        const from = height();
        body.style.overflow = "hidden";
        const animation = body.animate(
          [
            { height: `${from}px`, opacity: 1 },
            { height: "0px", opacity: 0 },
          ],
          { duration: CLOSE_MS, easing: EASING },
        );
        animation.onfinish = () => {
          details.open = false;
          body.style.overflow = "";
          animating = false;
        };
      } else {
        details.open = true;
        const to = height();
        body.style.overflow = "hidden";
        const animation = body.animate(
          [
            { height: "0px", opacity: 0 },
            { height: `${to}px`, opacity: 1 },
          ],
          { duration: OPEN_MS, easing: EASING },
        );
        animation.onfinish = () => {
          body.style.overflow = "";
          animating = false;
        };
      }
    });
  });
}
