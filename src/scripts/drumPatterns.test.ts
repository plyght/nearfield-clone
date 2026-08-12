import { test, expect } from "bun:test";
import { TEMPLATES, DEFAULTS, melodicRange, clampToMelody, baseNoise } from "./drumPatterns";

const { rows, cols } = DEFAULTS;

test("melodic range reserves the outer percussion rows", () => {
  expect(melodicRange(9)).toEqual([2, 6]);
  expect(melodicRange(4)).toEqual([1, 2]);
});

test("clampToMelody keeps rows inside the melodic band", () => {
  const [first, last] = melodicRange(rows);
  for (const row of [-5, 0, 3, 20]) {
    const clamped = clampToMelody(rows, row);
    expect(clamped).toBeGreaterThanOrEqual(first);
    expect(clamped).toBeLessThanOrEqual(last);
  }
});

test("every template fills the grid without escaping it", () => {
  for (const [name, template] of Object.entries(TEMPLATES)) {
    const cells = template.build(rows, cols);
    expect(cells.length, name).toBeGreaterThan(0);
    expect(new Set(cells).size, name).toBe(cells.length);

    for (const cell of cells) {
      const [row, col] = cell.split(",").map(Number);
      expect(Number.isInteger(row), `${name} ${cell}`).toBe(true);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(rows);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(cols);
    }
  }
});

test("the default template is one of the templates", () => {
  expect(Object.keys(TEMPLATES)).toContain(DEFAULTS.template);
});

test("baseNoise is deterministic and normalised", () => {
  for (const [row, col] of [
    [0, 0],
    [3, 7],
    [8, 25],
  ]) {
    const value = baseNoise(row, col);
    expect(value).toBe(baseNoise(row, col));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
});
