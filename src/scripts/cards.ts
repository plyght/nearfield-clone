import { ensureAudioGraph, resumeAudio, setSpatialDrive } from "./drumEngine";

/** Sweep interval bounds, in ms. The slider maps 0–100% onto this range. */
const FASTEST_MS = 60;
const SLOWEST_MS = 400;

export function initCards(): void {
  const views = document.querySelector<HTMLElement>("[data-driver-views]");
  const settingsToggle = document.querySelector<HTMLElement>("[data-view-toggle]");
  const settingsView = document.querySelector<HTMLElement>("[data-view-settings]");
  const speedSlider = document.querySelector<HTMLInputElement>("[data-speed-slider]");
  const templateButtons = [...document.querySelectorAll<HTMLElement>("[data-theme]")];

  /** Reflects engine state back into the slider and template buttons. */
  function syncControls(speed: number, template: string): void {
    if (speedSlider) {
      const percent = Math.round(((SLOWEST_MS - speed) / (SLOWEST_MS - FASTEST_MS)) * 100);
      speedSlider.value = String(Math.min(100, Math.max(0, percent)));
      speedSlider.style.setProperty("--pos", `${speedSlider.value}%`);
    }
    templateButtons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.theme === template)),
    );
  }

  try {
    const stored = JSON.parse(localStorage.getItem("nearfield:drum-machine") ?? "{}");
    syncControls(stored.sweepSpeed ?? 215, stored.template ?? "tapedream");
  } catch {
    syncControls(215, "tapedream");
  }

  document.addEventListener("nearfield:driver-state", (event) => {
    const detail = (event as CustomEvent).detail;
    if (detail) syncControls(detail.speed, detail.template);
  });

  const card = views?.closest("article");
  let hovering = false;

  /** Audio only runs while the card is hovered *and* the settings view is open. */
  function syncAudio(): void {
    const shouldPlay = hovering && views?.dataset.settingsOpen === "true";
    if (shouldPlay) {
      ensureAudioGraph();
      resumeAudio();
    }
    setSpatialDrive(shouldPlay, 0);
  }

  card?.addEventListener("pointerenter", () => {
    hovering = true;
    syncAudio();
  });

  card?.addEventListener("pointerleave", () => {
    hovering = false;
    syncAudio();
  });

  settingsToggle?.addEventListener("click", () => {
    if (!views) return;
    const open = views.dataset.settingsOpen !== "true";
    views.dataset.settingsOpen = String(open);
    settingsToggle.setAttribute("aria-expanded", String(open));
    settingsView?.setAttribute("aria-hidden", String(!open));
    syncAudio();
  });

  templateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("nearfield:driver-set", { detail: { template: button.dataset.theme } }),
      );
    });
  });

  speedSlider?.addEventListener("input", () => {
    const fraction = Number(speedSlider.value) / 100;
    const speed = Math.round(SLOWEST_MS - fraction * (SLOWEST_MS - FASTEST_MS));
    speedSlider.style.setProperty("--pos", `${speedSlider.value}%`);
    document.dispatchEvent(new CustomEvent("nearfield:driver-set", { detail: { speed } }));
  });
}
