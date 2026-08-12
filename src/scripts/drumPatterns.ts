/**
 * Pure grid/pattern maths for the step sequencer. No browser APIs here, so the
 * Astro component can import it at build time to seed the first paint.
 */

/** Rows that carry melody: the outer rows are reserved for percussion. */
export const melodicRange = (rows: number): [number, number] =>
  rows >= 6 ? [2, rows - 3] : [1, Math.max(1, rows - 2)];

export const clampToMelody = (rows: number, row: number): number => {
  const [first, last] = melodicRange(rows);
  return Math.min(last, Math.max(first, Math.round(row)));
};

/** 0→1→0 triangle over a unit period. */
const triangle = (x: number): number => Math.abs((((x % 1) + 1) % 1) - 0.5) * 2;

/** Maps a 0..steps scale degree onto a concrete grid row. */
function degreeToRow(rows: number, degree: number, steps = 8): number {
  const [first, last] = melodicRange(rows);
  const clamped = Math.min(steps, Math.max(0, degree));
  return clampToMelody(rows, first + ((last - first) * clamped) / steps);
}

function addDegree(
  cells: Set<string>,
  rows: number,
  col: number,
  degree: number | null,
  steps = 8,
): number | null {
  if (degree == null) return null;
  const row = degreeToRow(rows, degree, steps);
  cells.add(`${row},${col}`);
  return row;
}

const TAPE_DREAM_STEPS: (number | null)[] = [
  5,
  null,
  4,
  2,
  null,
  3,
  5,
  null,
  6,
  null,
  4,
  2,
  null,
  1,
  3,
  null,
];

export interface Template {
  label: string;
  speed: number;
  trail: number;
  build: (rows: number, cols: number) => string[];
}

export const TEMPLATES: Record<string, Template> = {
  tapedream: {
    label: "Tape Dream",
    speed: 215,
    trail: 7,
    build: (rows, cols) => {
      const cells = new Set<string>();
      for (let col = 0; col < cols; col++) {
        const step = col % TAPE_DREAM_STEPS.length;
        const degree = TAPE_DREAM_STEPS[step] ?? null;
        addDegree(cells, rows, col, degree);
        if (step === 3 || step === 13) {
          addDegree(cells, rows, col, degree == null ? null : degree + 2);
        }
        if (step === 0 || step === 8) cells.add(`${rows - 1},${col}`);
        if (step === 4 || step === 12) cells.add(`1,${col}`);
        if (step === 0 || step === 6 || step === 10) cells.add(`${rows - 2},${col}`);
        if (step === 2 || step === 10 || step === 14) cells.add(`0,${col}`);
      }
      return [...cells];
    },
  },
  synthwave: {
    label: "Synthwave",
    speed: 145,
    trail: 6,
    build: (rows, cols) => {
      const cells = new Set<string>();
      const [first, last] = melodicRange(rows);
      const span = Math.max(2, last - first);
      for (let col = 0; col < cols; col++) {
        cells.add(`${clampToMelody(rows, first + span * triangle(col * 0.125))},${col}`);
        if (col % 2 === 0) cells.add(`${rows - 2},${col}`);
        if (col % 4 === 0) cells.add(`${rows - 1},${col}`);
        if (col % 8 === 4) cells.add(`1,${col}`);
      }
      return [...cells];
    },
  },
  ambient: {
    label: "Ambient",
    speed: 320,
    trail: 7,
    build: (rows, cols) => {
      const cells = new Set<string>();
      const [first, last] = melodicRange(rows);
      const centre = (first + last) / 2;
      const swing = (last - first) / 2;
      for (let col = 0; col < cols; col++) {
        if (col % 2 === 0) {
          const row = clampToMelody(rows, centre + swing * Math.sin(col * 0.18 + 0.5));
          cells.add(`${row},${col}`);
          if (col % 6 === 0) cells.add(`${clampToMelody(rows, row - 2)},${col}`);
        }
        if (col % 8 === 0) cells.add(`${rows - 2},${col}`);
      }
      return [...cells];
    },
  },
};

export interface Settings {
  idleColor: string;
  idleOpacityMin: number;
  idleOpacityMax: number;
  activeColor: string;
  activeOpacity: number;
  hoverColor: string;
  hoverOpacity: number;
  highlightColor: string;
  highlightOpacity: number;
  rows: number;
  cols: number;
  sweepColor: string;
  sweepOpacity: number;
  sweepSpeed: number;
  trail: number;
  falloff: number;
  uniformity: number;
  soundOn: boolean;
  template: string;
}

export const DEFAULTS: Settings = {
  idleColor: "#000000",
  idleOpacityMin: 17,
  idleOpacityMax: 61,
  activeColor: "#ffffff",
  activeOpacity: 0.17,
  hoverColor: "#ffffff",
  hoverOpacity: 0.87,
  highlightColor: "#ffffff",
  highlightOpacity: 1,
  rows: 9,
  cols: 26,
  sweepColor: "#ffffff",
  sweepOpacity: 0.5,
  sweepSpeed: 215,
  trail: 4,
  falloff: 0.45,
  uniformity: 0.13,
  soundOn: true,
  template: "tapedream",
};

/** Stable per-cell noise so the idle field looks organic but never reshuffles. */
export function baseNoise(row: number, col: number): number {
  const value = Math.sin((row + 1) * 12.9898 + (col + 1) * 78.233) * 43758.5453;
  return +(value - Math.floor(value)).toFixed(3);
}

export const cellKey = (row: number, col: number): string => `${row},${col}`;
