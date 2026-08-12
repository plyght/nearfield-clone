import { ensureAudioGraph, resumeAudio, setSpatialDrive, setPan } from "./drumEngine";

/** Note glyph spawned above the active screen while audio is playing. */
const NOTE_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';

export function initSpatialDisplay(root: HTMLElement): void {
  const windowEl = root.querySelector<HTMLElement>("[data-window]");
  const maskEl = root.querySelector<HTMLElement>("[data-window-mask]");
  const clipPathEl = root.querySelector<SVGElement>("[data-clip-path]");
  const clipRects = [...root.querySelectorAll<SVGRectElement>("[data-clip-rect]")];
  const displays = [...root.querySelectorAll<HTMLElement>("[data-display]")];

  if (!windowEl || !maskEl || !clipPathEl || clipRects.length < 2 || displays.length < 2) return;

  const clipId = `spatial-clip-${Math.random().toString(36).slice(2, 9)}`;
  clipPathEl.id = clipId;
  maskEl.style.clipPath = `url(#${clipId})`;

  let activeIndex = 1;
  let windowX = 0;
  let windowY = 0;
  let windowW = 0;
  let windowH = 0;
  let hasBeenDragged = false;

  root.dataset.windowMode = "drag";

  function applyPosition(): void {
    windowEl!.style.setProperty("--window-x", `${windowX}px`);
    windowEl!.style.setProperty("--window-y", `${windowY}px`);
  }

  /** Resting offset of the window over display `index`, in root-relative px. */
  function restingPosition(index: number): { x: number; y: number } {
    const rootRect = root.getBoundingClientRect();
    const displayRect = displays[index].getBoundingClientRect();
    const unit = displays[0].getBoundingClientRect().width;
    return {
      x: displayRect.left - rootRect.left + 0.2635 * unit,
      y: displayRect.top - rootRect.top + 0.168 * unit,
    };
  }

  /** Display whose centre is nearest the window's centre. */
  function nearestDisplay(x: number): number {
    const rootRect = root.getBoundingClientRect();
    const centre = x + windowW / 2;
    let nearest = 0;
    let shortest = Infinity;
    displays.forEach((display, index) => {
      const rect = display.getBoundingClientRect();
      const displayCentre = rect.left - rootRect.left + rect.width / 2;
      const distance = Math.abs(centre - displayCentre);
      if (distance < shortest) {
        nearest = index;
        shortest = distance;
      }
    });
    return nearest;
  }

  function setActive(index: number): void {
    if (index === activeIndex) return;
    activeIndex = index;
    root.dataset.active = String(activeIndex);
    if (hovering || playing) setPan(activeIndex === 0 ? -1 : 1);
  }

  function layout(): void {
    const rootRect = root.getBoundingClientRect();
    const unit = displays[0].getBoundingClientRect().width;

    windowW = 0.425 * unit;
    windowH = 0.234 * unit;
    windowEl!.style.width = `${windowW}px`;
    windowEl!.style.height = `${windowH}px`;
    windowEl!.style.borderRadius = `${0.0195 * unit}px`;
    windowEl!.style.left = "0px";
    windowEl!.style.top = "0px";

    // Keep the SVG clip rects aligned with each physical screen.
    displays.forEach((display, index) => {
      const screen = display.querySelector(".screen");
      const rect = clipRects[index];
      if (!screen || !rect) return;
      const screenRect = screen.getBoundingClientRect();
      const radius = 0.016 * unit;
      rect.setAttribute("x", String(screenRect.left - rootRect.left));
      rect.setAttribute("y", String(screenRect.top - rootRect.top));
      rect.setAttribute("width", String(screenRect.width));
      rect.setAttribute("height", String(screenRect.height));
      rect.setAttribute("rx", String(radius));
      rect.setAttribute("ry", String(radius));
    });

    if (hasBeenDragged) {
      windowX = Math.min(Math.max(0, windowX), Math.max(0, rootRect.width - windowW));
      windowY = Math.min(Math.max(0, windowY), Math.max(0, rootRect.height - windowH));
      activeIndex = nearestDisplay(windowX);
    } else {
      const resting = restingPosition(activeIndex);
      windowX = resting.x;
      windowY = resting.y;
    }

    windowEl!.style.transition = "none";
    applyPosition();
    void windowEl!.offsetWidth;
    windowEl!.style.transition = "";
    root.dataset.active = String(activeIndex);
    windowEl!.classList.add("ready");
  }

  new ResizeObserver(() => layout()).observe(root);
  layout();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bars = [...windowEl.querySelectorAll<HTMLElement>(".bar")];

  let hovering = false;
  let playing = false;
  let dragging = false;
  let dragPointerId = -1;
  let grabOffsetX = 0;
  let grabOffsetY = 0;

  windowEl.dataset.soundActive = "false";

  const barMotion = bars.map((_, index) => ({
    frequency: 5.5 + index * 1.6 + Math.random() * 2,
    phase: Math.random() * 6.28,
  }));

  let barRaf = 0;
  let barMix = 0;

  function animateBars(now: number): void {
    const seconds = now / 1000;
    barMix += ((hovering || playing ? 1 : 0) - barMix) * 0.1;
    for (let i = 0; i < bars.length; i++) {
      const motion = barMotion[i];
      const level = 0.45 + (0.5 + 0.5 * Math.sin(seconds * motion.frequency + motion.phase));
      bars[i].style.transform = `scaleY(${(1 + barMix * (level - 1)).toFixed(3)})`;
    }
    if (hovering || playing || barMix > 0.01) {
      barRaf = requestAnimationFrame(animateBars);
    } else {
      bars.forEach((bar) => (bar.style.transform = ""));
      barRaf = 0;
    }
  }

  function startBars(): void {
    if (!barRaf) barRaf = requestAnimationFrame(animateBars);
  }

  let noteTimer = 0;

  function spawnNote(): void {
    const rootRect = root.getBoundingClientRect();
    const screen = displays[activeIndex].querySelector(".screen");
    if (!screen) return;

    const screenRect = screen.getBoundingClientRect();
    const note = document.createElement("span");
    note.className = "note";
    note.innerHTML = NOTE_SVG;

    const size = 11 + Math.random() * 11;
    const acrossFraction = 0.05 + Math.random() * 0.9;
    const downFraction = 0.08 + Math.random() * 0.1;

    note.style.left = `${screenRect.left - rootRect.left + screenRect.width * acrossFraction}px`;
    note.style.top = `${screenRect.top - rootRect.top + screenRect.height * downFraction}px`;
    note.style.setProperty("--sz", `${size}px`);
    note.style.setProperty(
      "--dx",
      `${(Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 24)}px`,
    );
    note.style.setProperty("--dy", `${-42 - Math.random() * 42}px`);
    note.style.setProperty("--rot0", `${Math.random() * 30 - 15}deg`);
    note.style.setProperty("--rot1", `${Math.random() * 60 - 30}deg`);
    note.style.setProperty("--op", (0.45 + Math.random() * 0.35).toFixed(2));
    note.style.setProperty("--dur", `${(1.5 + Math.random() * 0.9).toFixed(2)}s`);
    note.addEventListener("animationend", () => note.remove());
    root.appendChild(note);
  }

  function startNotes(): void {
    if (noteTimer) return;
    spawnNote();
    noteTimer = window.setInterval(spawnNote, 400);
  }

  function stopNotes(): void {
    clearInterval(noteTimer);
    noteTimer = 0;
    root.querySelectorAll(".note").forEach((note) => note.remove());
  }

  window.addEventListener(
    "pointerdown",
    () => {
      ensureAudioGraph();
      resumeAudio();
    },
    { once: true },
  );

  function enter(): void {
    const wasHovering = hovering;
    hovering = true;
    startPlaying();
    if (!reducedMotion && !wasHovering) startBars();
  }

  function startPlaying(): void {
    if (playing) return;
    playing = true;
    windowEl!.dataset.soundActive = "true";
    windowEl!.classList.add("is-playing");
    ensureAudioGraph();
    resumeAudio();
    setSpatialDrive(true, activeIndex === 0 ? -1 : 1);
    if (!reducedMotion) {
      startBars();
      startNotes();
    }
  }

  function leave(): void {
    if (dragging) return;
    if (!hovering && !playing) return;
    hovering = false;
    stopPlaying();
  }

  function stopPlaying(): void {
    if (!playing && !windowEl!.classList.contains("is-playing")) return;
    playing = false;
    windowEl!.dataset.soundActive = "false";
    windowEl!.classList.remove("is-playing");
    stopNotes();
    setSpatialDrive(false);
    if (!hovering) {
      barMix = 0;
      if (barRaf) cancelAnimationFrame(barRaf);
      barRaf = 0;
      bars.forEach((bar) => (bar.style.transform = ""));
    }
  }

  windowEl.addEventListener("pointerenter", enter);
  windowEl.addEventListener("pointerleave", leave);

  function moveWindow(clientX: number, clientY: number): void {
    const rootRect = root.getBoundingClientRect();
    windowX = clientX - rootRect.left - grabOffsetX;
    windowY = clientY - rootRect.top - grabOffsetY;
    windowX = Math.min(Math.max(0, windowX), Math.max(0, rootRect.width - windowW));
    windowY = Math.min(Math.max(0, windowY), Math.max(0, rootRect.height - windowH));
    applyPosition();
    setActive(nearestDisplay(windowX));
  }

  function pointerInsideWindow(clientX: number, clientY: number): boolean {
    const rect = windowEl!.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    enter();
    dragging = true;
    hasBeenDragged = true;
    dragPointerId = event.pointerId;
    windowEl!.classList.add("dragging");

    const rect = windowEl!.getBoundingClientRect();
    grabOffsetX = event.clientX - rect.left;
    grabOffsetY = event.clientY - rect.top;

    try {
      windowEl!.setPointerCapture(event.pointerId);
    } catch {}
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragPointerId) return;
    event.preventDefault();
    moveWindow(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = -1;
    windowEl!.classList.remove("dragging");
    try {
      windowEl!.releasePointerCapture(event.pointerId);
    } catch {}
    if (event.pointerType !== "mouse" || !pointerInsideWindow(event.clientX, event.clientY)) {
      leave();
    }
  }

  windowEl.addEventListener("pointerdown", onPointerDown);
  windowEl.addEventListener("pointermove", onPointerMove);
  windowEl.addEventListener("pointerup", onPointerUp);
  windowEl.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      leave();
      stopPlaying();
    }
  });
}
