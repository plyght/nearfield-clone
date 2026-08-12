import {
  ensureAudioGraph,
  resumeAudio,
  playStep,
  spatialDriveLevel,
  isSpatialDriveOn,
} from "./drumEngine";

import { TEMPLATES, DEFAULTS, baseNoise, cellKey, type Settings } from "./drumPatterns";

export { TEMPLATES, DEFAULTS, baseNoise };

const SETTINGS_KEY = "nearfield:drum-machine";
const SOUND_KEY = "nearfield:sound-enabled";
const PANEL_KEY = "nearfield:drum-machine-panel";

const COLOR_KEYS = [
  "idleColor",
  "activeColor",
  "hoverColor",
  "highlightColor",
  "sweepColor",
] as const;

function loadSettings(): Settings {
  const settings: Settings = { ...DEFAULTS };
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>;
      for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
        if (key === "soundOn") continue;
        const value = parsed[key];
        if (typeof value === typeof DEFAULTS[key]) {
          settings[key] = value as never;
        }
      }
    }
    const sound = localStorage.getItem(SOUND_KEY);
    if (sound != null) settings.soundOn = JSON.parse(sound) === true;
  } catch {}
  return settings;
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(SOUND_KEY, JSON.stringify(settings.soundOn));
  } catch {}
  document.dispatchEvent(
    new CustomEvent("nearfield:driver-state", {
      detail: { speed: settings.sweepSpeed, template: settings.template },
    }),
  );
}

/** "#f0a" | "#ff00aa" -> "255, 0, 170" for use inside rgba(). */
function toRgbTriplet(hex: string): string {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  const value = Number.parseInt(full || "000000", 16);
  if (Number.isNaN(value)) return "0, 0, 0";
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

function formatValue(input: HTMLInputElement, value: number): string {
  const format = input.dataset.fmt;
  if (format === "pct") return `${Math.round(value)}%`;
  if (format === "int") return String(Math.round(value));
  return value.toFixed(2);
}

export function initDrumMachine(root: HTMLElement): () => void {
  if (root.dataset.driverReady === "true") return () => {};
  root.dataset.driverReady = "true";

  const grid = root.querySelector<HTMLElement>("[data-grid]");
  if (!grid) return () => {};

  const panel = root.querySelector<HTMLElement>("[data-panel]") ?? document.createElement("aside");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const settings = loadSettings();

  let hasStoredSettings = false;
  try {
    hasStoredSettings = localStorage.getItem(SETTINGS_KEY) != null;
  } catch {}

  let rows = settings.rows;
  let cols = settings.cols;
  let cellsByColumn: HTMLElement[][] = [];

  const activeCells = new Set<string>();
  grid.querySelectorAll(".cell.on").forEach((cell) => {
    const el = cell as HTMLElement;
    activeCells.add(cellKey(Number(el.dataset.row), Number(el.dataset.col)));
  });

  function indexCells(): void {
    cellsByColumn = Array.from({ length: cols }, () => []);
    grid!.querySelectorAll(".cell").forEach((cell) => {
      const el = cell as HTMLElement;
      cellsByColumn[Number(el.dataset.col)]?.push(el);
    });
  }

  function renderGrid(): void {
    root.dataset.rows = String(rows);
    root.dataset.cols = String(cols);
    root.style.setProperty("--rows", String(rows));
    root.style.setProperty("--cols", String(cols));

    const fragment = document.createDocumentFragment();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = document.createElement("span");
        const base = String(baseNoise(row, col));
        cell.className = activeCells.has(cellKey(row, col)) ? "cell on" : "cell";
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.dataset.base = base;
        cell.style.setProperty("--base", base);
        fragment.append(cell);
      }
    }
    grid!.replaceChildren(fragment);
    indexCells();
    if (sweepColumn >= cols) sweepColumn = -1;
  }

  function resizeGrid(): boolean {
    const nextRows = Math.round(settings.rows);
    const nextCols = Math.round(settings.cols);
    if (nextRows === rows && nextCols === cols) return false;
    rows = nextRows;
    cols = nextCols;
    renderGrid();
    return true;
  }

  /** Light-mode substitutes, applied only while a colour is still at default. */
  const LIGHT_OVERRIDES: Record<string, string> = {
    idleColor: "#ffffff",
    activeColor: "#1a1a19",
    hoverColor: "#1a1a19",
    highlightColor: "#1a1a19",
    sweepColor: "#1a1a19",
  };

  function isDark(color: string): boolean {
    const [r, g, b] = toRgbTriplet(color).split(",").map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }

  function resolveColor(key: (typeof COLOR_KEYS)[number]): string {
    const value = settings[key];
    if (
      value.toLowerCase() === DEFAULTS[key].toLowerCase() &&
      document.documentElement.dataset.theme === "light"
    ) {
      return LIGHT_OVERRIDES[key];
    }
    return value;
  }

  function applyColors(): void {
    const min = clamp01(settings.idleOpacityMin / 100);
    const max = clamp01(settings.idleOpacityMax / 100);
    root.style.setProperty("--cell-idle-rgb", toRgbTriplet(resolveColor("idleColor")));
    root.style.setProperty("--cell-on-rgb", toRgbTriplet(resolveColor("activeColor")));
    root.style.setProperty("--cell-hover-rgb", toRgbTriplet(resolveColor("hoverColor")));
    root.style.setProperty("--idle-min", String(Math.min(min, max)));
    root.style.setProperty("--idle-max", String(Math.max(min, max)));
    root.style.setProperty("--cell-on-alpha", String(clamp01(settings.activeOpacity)));
    root.style.setProperty("--cell-hover-alpha", String(clamp01(settings.hoverOpacity)));
  }

  let sweepColumn = -1;
  let sweepTimer = 0;
  let onScreen = true;
  let pointerInside = false;
  let spatialDriving = false;
  let touchPointerId = -1;

  root.dataset.soundActive = "false";

  function trailWeights(): number[] {
    const length = Math.max(1, Math.round(settings.trail));
    const weights: number[] = [];
    for (let i = 0; i < length; i++) {
      weights.push(+Math.pow(clamp01(settings.falloff), i).toFixed(3));
    }
    return weights;
  }

  function paint(allowSound: boolean): void {
    if (sweepColumn < 0) return;

    const driveLevel = spatialDriveLevel();
    const level = Math.max(pointerInside ? 1 : 0, driveLevel);
    const soundActive = settings.soundOn && (pointerInside || isSpatialDriveOn());
    const velocity = soundActive ? level : 0;

    const weights = trailWeights();
    const sweepRgb = toRgbTriplet(resolveColor("sweepColor"));
    const sweepOpacity = clamp01(settings.sweepOpacity);
    const highlightRgb = toRgbTriplet(resolveColor("highlightColor"));
    const highlightOpacity = clamp01(settings.highlightOpacity);
    const activeOpacity = clamp01(settings.activeOpacity);

    // On light backgrounds the idle field has to show through the sweep.
    const blendIdle =
      document.documentElement.dataset.theme === "light" && isDark(resolveColor("idleColor"));
    const idleMin = Math.min(
      clamp01(settings.idleOpacityMin / 100),
      clamp01(settings.idleOpacityMax / 100),
    );
    const idleMax = Math.max(
      clamp01(settings.idleOpacityMin / 100),
      clamp01(settings.idleOpacityMax / 100),
    );

    const jitterAmount = clamp01(settings.uniformity) * 0.3;
    const trailSpan = Math.max(1, weights.length - 1);

    const jitterFor = (cell: HTMLElement): number => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const value = Math.sin((row + 7) * 37.719 + (col + 3) * 17.923) * 24571.417;
      return (value - Math.floor(value)) * 2 - 1;
    };

    for (let col = 0; col < cols; col++) {
      let distance = sweepColumn - col;
      if (distance < 0) distance += cols;
      const weight = distance < weights.length ? weights[distance] : null;

      for (const cell of cellsByColumn[col] ?? []) {
        if (weight == null) {
          if (cell.style.backgroundColor) cell.style.backgroundColor = "";
          continue;
        }

        const jitterScale = jitterAmount * (distance / trailSpan);
        const jitter = jitterScale === 0 ? 1 : 1 + jitterFor(cell) * jitterScale;

        if (cell.classList.contains("on")) {
          const alpha = +clamp01(
            (activeOpacity + (highlightOpacity - activeOpacity) * weight) * jitter,
          ).toFixed(3);
          cell.style.backgroundColor = `rgba(${highlightRgb}, ${alpha})`;
          if (allowSound && distance === 0 && soundActive) {
            playStep(Number(cell.dataset.row), rows, sweepColumn, velocity);
          }
        } else {
          let alpha = clamp01(sweepOpacity * weight * jitter);
          if (blendIdle) {
            const idle = idleMin + (Number(cell.dataset.base) || 0) * (idleMax - idleMin);
            alpha = clamp01(alpha + idle * (1 - alpha));
          }
          cell.style.backgroundColor = `rgba(${sweepRgb}, ${+alpha.toFixed(3)})`;
        }
      }
    }
  }

  function advance(): void {
    sweepColumn = (sweepColumn + 1) % cols;
    paint(true);
  }

  function startSweep(): void {
    if (sweepTimer || reducedMotion) return;
    if (!onScreen && !spatialDriving) return;
    sweepTimer = window.setInterval(advance, settings.sweepSpeed);
  }

  function stopSweep(): void {
    clearInterval(sweepTimer);
    sweepTimer = 0;
  }

  function restartSweep(): void {
    const wasRunning = !!sweepTimer;
    stopSweep();
    if (wasRunning) startSweep();
  }

  const onGridClick = (event: MouseEvent): void => {
    const cell = (event.target as Element).closest<HTMLElement>(".cell");
    if (!cell || !grid!.contains(cell)) return;
    const key = cellKey(Number(cell.dataset.row), Number(cell.dataset.col));
    if (cell.classList.toggle("on")) {
      activeCells.add(key);
    } else {
      activeCells.delete(key);
      cell.style.backgroundColor = "";
    }
    // Hand-editing the grid means it is no longer one of the presets.
    if (settings.template) {
      settings.template = "";
      if (templateSelect) templateSelect.value = "";
    }
    saveSettings(settings);
  };
  grid.addEventListener("click", onGridClick);

  const onGridEnter = (): void => {
    pointerInside = true;
    root.dataset.soundActive = "true";
    if (settings.soundOn) {
      ensureAudioGraph();
      resumeAudio();
    }
  };

  const onGridLeave = (): void => {
    pointerInside = false;
    root.dataset.soundActive = "false";
  };

  grid.addEventListener("pointerenter", onGridEnter);
  grid.addEventListener("pointerleave", onGridLeave);

  const onGridPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") return;
    touchPointerId = event.pointerId;
    pointerInside = true;
    root.dataset.soundActive = "true";
    ensureAudioGraph();
    resumeAudio();
    const cell = (event.target as Element).closest<HTMLElement>(".cell");
    if (settings.soundOn && cell && grid!.contains(cell)) {
      playStep(Number(cell.dataset.row), rows, Number(cell.dataset.col), 1);
    }
  };

  const onGridPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== touchPointerId) return;
    touchPointerId = -1;
    pointerInside = false;
    root.dataset.soundActive = "false";
  };

  grid.addEventListener("pointerdown", onGridPointerDown);
  grid.addEventListener("pointerup", onGridPointerUp);
  grid.addEventListener("pointercancel", onGridPointerUp);

  const onSpatialDriveChanged = (event: Event): void => {
    spatialDriving = !!(event as CustomEvent).detail?.on;
    if (onScreen || spatialDriving) startSweep();
    else stopSweep();
  };
  window.addEventListener("nearfield:spatial-drive-changed", onSpatialDriveChanged);

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen || spatialDriving) startSweep();
      else stopSweep();
    },
    { threshold: 0 },
  );
  visibilityObserver.observe(root);

  const unlockAudio = (): void => {
    ensureAudioGraph();
    resumeAudio();
  };
  window.addEventListener("pointerdown", unlockAudio, { once: true });

  const controls = [...panel.querySelectorAll<HTMLInputElement>("[data-k]")];
  const outputs = new Map<string, HTMLElement>();
  panel.querySelectorAll<HTMLElement>("[data-out]").forEach((out) => {
    outputs.set(out.dataset.out!, out);
  });

  function syncControls(): void {
    for (const control of controls) {
      const key = control.dataset.k as keyof Settings;
      const value = settings[key];
      control.value = String(value);
      const output = outputs.get(key);
      if (output && typeof value === "number") {
        output.textContent = formatValue(control, value);
      }
    }
  }

  const onControlInput = (event: Event): void => {
    const control = event.currentTarget as HTMLInputElement;
    const key = control.dataset.k as keyof Settings;

    if ((COLOR_KEYS as readonly string[]).includes(key)) {
      settings[key] = control.value as never;
    } else {
      const value = Number(control.value);
      settings[key] = value as never;
      const output = outputs.get(key);
      if (output) output.textContent = formatValue(control, value);
    }

    const resized = key === "rows" || key === "cols" ? resizeGrid() : false;
    applyColors();
    paint(false);
    if (key === "sweepSpeed" || resized) restartSweep();
    saveSettings(settings);
  };
  controls.forEach((control) => control.addEventListener("input", onControlInput));

  const panelBody = panel.querySelector<HTMLElement>("[data-body]");
  const onPanelWheel = (event: WheelEvent): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "range") {
      event.preventDefault();
      if (panelBody) panelBody.scrollTop += event.deltaY;
    }
  };
  panelBody?.addEventListener("wheel", onPanelWheel, { passive: false });

  const templateSelect = panel.querySelector<HTMLSelectElement>("[data-template]");

  function applyTemplate(name: string): void {
    const template = TEMPLATES[name];
    if (!template) return;
    settings.template = name;
    activeCells.clear();
    for (const key of template.build(rows, cols)) activeCells.add(key);
    if (template.speed != null) settings.sweepSpeed = template.speed;
    if (template.trail != null) settings.trail = template.trail;
    renderGrid();
    applyColors();
    syncControls();
    if (templateSelect) templateSelect.value = name;
    paint(false);
    restartSweep();
    saveSettings(settings);
  }

  const onTemplateChange = (): void => {
    if (!templateSelect) return;
    if (templateSelect.value) {
      applyTemplate(templateSelect.value);
    } else {
      settings.template = "";
      saveSettings(settings);
    }
  };
  templateSelect?.addEventListener("change", onTemplateChange);

  const onDriverSet = (event: Event): void => {
    const detail = (event as CustomEvent).detail ?? {};
    if (typeof detail.template === "string" && TEMPLATES[detail.template]) {
      applyTemplate(detail.template);
    }
    if (typeof detail.speed === "number" && Number.isFinite(detail.speed)) {
      settings.sweepSpeed = Math.min(400, Math.max(60, Math.round(detail.speed)));
      syncControls();
      restartSweep();
      saveSettings(settings);
    }
  };
  document.addEventListener("nearfield:driver-set", onDriverSet);

  const toggleButton = panel.querySelector<HTMLButtonElement>("[data-toggle]");
  const resetButton = panel.querySelector<HTMLButtonElement>("[data-reset]");
  const copyButton = panel.querySelector<HTMLButtonElement>("[data-copy]");
  let copyResetTimer = 0;

  const onTogglePanel = (): void => {
    const collapsed = panel.dataset.collapsed !== "true";
    panel.dataset.collapsed = String(collapsed);
    toggleButton?.setAttribute("aria-expanded", String(!collapsed));
    if (toggleButton) toggleButton.textContent = collapsed ? "Show" : "Hide";
  };

  const onReset = (): void => {
    Object.assign(settings, DEFAULTS);
    resizeGrid();
    applyColors();
    syncControls();
    syncSoundButton();
    if (templateSelect) templateSelect.value = settings.template;
    paint(false);
    restartSweep();
    saveSettings(settings);
  };

  function serializeState(): string {
    return JSON.stringify(
      {
        template: settings.template || "custom",
        idle: {
          color: settings.idleColor,
          opacityMin: settings.idleOpacityMin,
          opacityMax: settings.idleOpacityMax,
        },
        active: { color: settings.activeColor, opacity: settings.activeOpacity },
        hover: { color: settings.hoverColor, opacity: settings.hoverOpacity },
        highlight: { color: settings.highlightColor, opacity: settings.highlightOpacity },
        layout: { rows: settings.rows, cols: settings.cols },
        sweep: {
          color: settings.sweepColor,
          baseOpacity: settings.sweepOpacity,
          speed: settings.sweepSpeed,
          trail: settings.trail,
          falloff: settings.falloff,
          uniformity: settings.uniformity,
        },
        pattern: [...activeCells].sort(),
      },
      null,
      2,
    );
  }

  async function copyText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {}
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy unavailable");
  }

  const onCopy = async (): Promise<void> => {
    if (!copyButton) return;
    try {
      await copyText(serializeState());
      copyButton.textContent = "Copied";
    } catch {
      copyButton.textContent = "Failed";
    }
    window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => {
      if (copyButton) copyButton.textContent = "Copy";
    }, 1200);
  };

  const soundButton = panel.querySelector<HTMLButtonElement>("[data-sound]");

  function syncSoundButton(): void {
    if (soundButton) {
      soundButton.textContent = settings.soundOn ? "🔊" : "🔇";
      soundButton.setAttribute("aria-pressed", String(settings.soundOn));
      const label = settings.soundOn ? "Mute sound" : "Unmute sound";
      soundButton.title = label;
      soundButton.setAttribute("aria-label", label);
    }
    document.dispatchEvent(
      new CustomEvent("nearfield:sound-changed", { detail: { on: settings.soundOn } }),
    );
  }

  function setSound(on: boolean): void {
    settings.soundOn = on;
    if (settings.soundOn) {
      ensureAudioGraph();
      resumeAudio();
    }
    syncSoundButton();
    saveSettings(settings);
  }

  const onSoundToggle = (): void => setSound(!settings.soundOn);
  const onSoundSet = (event: Event): void => {
    setSound(!!(event as CustomEvent).detail?.on);
  };

  document.addEventListener("nearfield:sound-set", onSoundSet);
  toggleButton?.addEventListener("click", onTogglePanel);
  resetButton?.addEventListener("click", onReset);
  copyButton?.addEventListener("click", onCopy);
  soundButton?.addEventListener("click", onSoundToggle);

  // Draggable settings panel.
  const panelBar = panel.querySelector<HTMLElement>(".panel-bar");

  function movePanel(x: number, y: number): void {
    const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
    panel.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
    panel.style.top = `${Math.min(Math.max(0, y), maxY)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  try {
    const stored = localStorage.getItem(PANEL_KEY);
    if (stored) {
      const position = JSON.parse(stored);
      if (Number.isFinite(position.x) && Number.isFinite(position.y)) {
        movePanel(position.x, position.y);
      }
    }
  } catch {}

  let panelPointerId = -1;
  let panelGrabX = 0;
  let panelGrabY = 0;
  let panelStartX = 0;
  let panelStartY = 0;

  const onPanelPointerDown = (event: PointerEvent): void => {
    if ((event.target as Element).closest("button")) return;
    const rect = panel.getBoundingClientRect();
    panelStartX = rect.left;
    panelStartY = rect.top;
    movePanel(panelStartX, panelStartY);
    panelPointerId = event.pointerId;
    panelGrabX = event.clientX;
    panelGrabY = event.clientY;
    panel.dataset.dragging = "true";
    try {
      panelBar?.setPointerCapture(event.pointerId);
    } catch {}
    event.preventDefault();
  };

  const onPanelPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== panelPointerId) return;
    movePanel(
      panelStartX + (event.clientX - panelGrabX),
      panelStartY + (event.clientY - panelGrabY),
    );
  };

  const onPanelPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== panelPointerId) return;
    panelPointerId = -1;
    panel.dataset.dragging = "false";
    try {
      panelBar?.releasePointerCapture?.(event.pointerId);
    } catch {}
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify({ x: panel.offsetLeft, y: panel.offsetTop }));
    } catch {}
  };

  panelBar?.addEventListener("pointerdown", onPanelPointerDown);
  panelBar?.addEventListener("pointermove", onPanelPointerMove);
  panelBar?.addEventListener("pointerup", onPanelPointerUp);
  panelBar?.addEventListener("pointercancel", onPanelPointerUp);

  if (window.matchMedia("(max-width: 560px)").matches) {
    panel.dataset.collapsed = "true";
    toggleButton?.setAttribute("aria-expanded", "false");
    if (toggleButton) toggleButton.textContent = "Show";
  }

  const themeObserver = new MutationObserver(() => {
    applyColors();
    paint(false);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  resizeGrid();
  indexCells();
  if (templateSelect) templateSelect.value = settings.template;
  if (hasStoredSettings && settings.template && TEMPLATES[settings.template]) {
    applyTemplate(settings.template);
  }
  applyColors();
  syncControls();
  syncSoundButton();
  startSweep();
  document.dispatchEvent(
    new CustomEvent("nearfield:driver-state", {
      detail: { speed: settings.sweepSpeed, template: settings.template },
    }),
  );

  return function destroy(): void {
    stopSweep();
    themeObserver.disconnect();
    visibilityObserver.disconnect();
    grid.removeEventListener("click", onGridClick);
    grid.removeEventListener("pointerenter", onGridEnter);
    grid.removeEventListener("pointerleave", onGridLeave);
    grid.removeEventListener("pointerdown", onGridPointerDown);
    grid.removeEventListener("pointerup", onGridPointerUp);
    grid.removeEventListener("pointercancel", onGridPointerUp);
    window.removeEventListener("nearfield:spatial-drive-changed", onSpatialDriveChanged);
    window.removeEventListener("pointerdown", unlockAudio);
    controls.forEach((control) => control.removeEventListener("input", onControlInput));
    panelBody?.removeEventListener("wheel", onPanelWheel);
    templateSelect?.removeEventListener("change", onTemplateChange);
    document.removeEventListener("nearfield:driver-set", onDriverSet);
    toggleButton?.removeEventListener("click", onTogglePanel);
    resetButton?.removeEventListener("click", onReset);
    copyButton?.removeEventListener("click", onCopy);
    soundButton?.removeEventListener("click", onSoundToggle);
    document.removeEventListener("nearfield:sound-set", onSoundSet);
    panelBar?.removeEventListener("pointerdown", onPanelPointerDown);
    panelBar?.removeEventListener("pointermove", onPanelPointerMove);
    panelBar?.removeEventListener("pointerup", onPanelPointerUp);
    panelBar?.removeEventListener("pointercancel", onPanelPointerUp);
    window.clearTimeout(copyResetTimer);
    delete root.dataset.soundActive;
    delete root.dataset.driverReady;
  };
}
