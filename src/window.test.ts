import { describe, expect, it } from "vitest";
import { windowFor } from "./window.js";

describe("windowFor", () => {
  it("returns the full range when count fits within maxRows", () => {
    expect(windowFor(5, 2, 10)).toEqual({ start: 0, end: 5 });
  });

  it("returns the full range when count exactly equals maxRows", () => {
    expect(windowFor(10, 0, 10)).toEqual({ start: 0, end: 10 });
  });

  it("centers the selected row once the list exceeds maxRows", () => {
    // selected=50 of 100, window of 10 -> centered start = 50 - 5 = 45
    expect(windowFor(100, 50, 10)).toEqual({ start: 45, end: 55 });
  });

  it("clamps the start to 0 when selection is near the top", () => {
    expect(windowFor(100, 0, 10)).toEqual({ start: 0, end: 10 });
    expect(windowFor(100, 2, 10)).toEqual({ start: 0, end: 10 });
  });

  it("clamps the end to count when selection is near the bottom", () => {
    expect(windowFor(100, 99, 10)).toEqual({ start: 90, end: 100 });
  });

  it("never returns a window wider than maxRows", () => {
    for (const selected of [0, 1, 25, 49, 50, 75, 99]) {
      const { start, end } = windowFor(100, selected, 10);
      expect(end - start).toBe(10);
    }
  });
});
