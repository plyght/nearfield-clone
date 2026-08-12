/**
 * Drives `--scroll-progress` on each companion section as it crosses the
 * viewport. The CSS uses it to slide the settings-window mock upward by
 * `--app-window-travel`.
 *
 * Raw progress runs 0→1 from "section bottom entering" to "section top leaving";
 * it is then remapped so the travel only happens over the 0.48–0.95 slice.
 */
const START = 0.48;
const SPAN = 0.47;

export function initCompanionScroll(): void {
  const sections = document.querySelectorAll<HTMLElement>("[data-companion-section]");
  if (!sections.length) return;

  const update = (): void => {
    const viewportHeight = window.innerHeight;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const raw = (viewportHeight - rect.top) / (viewportHeight + rect.height);
      const progress = Math.min(1, Math.max(0, (raw - START) / SPAN));
      section.style.setProperty("--scroll-progress", progress.toFixed(4));
    }
  };

  let frame = 0;
  const schedule = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };

  update();
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
}
