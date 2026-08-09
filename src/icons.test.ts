import { describe, expect, it } from "vitest";
import { ICON } from "./icons.js";

describe("ICON", () => {
  it("every glyph is exactly one character (single Private Use Area codepoint)", () => {
    for (const [name, glyph] of Object.entries(ICON)) {
      expect(glyph, `${name} should be 1 character`).toHaveLength(1);
    }
  });

  it("every glyph falls in the Private Use Area (U+E000-U+F8FF, Nerd Fonts range)", () => {
    for (const [name, glyph] of Object.entries(ICON)) {
      const codePoint = glyph.codePointAt(0)!;
      expect(codePoint, `${name} (0x${codePoint.toString(16)}) should be in the PUA`).toBeGreaterThanOrEqual(0xe000);
      expect(codePoint).toBeLessThanOrEqual(0xf8ff);
    }
  });

  it("has no two icon names sharing the same glyph (each visual marker is unique)", () => {
    const glyphs = Object.values(ICON);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});
