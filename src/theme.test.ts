import { describe, expect, it } from "vitest";
import { monokaiClassic, monokaiPro, sonicConsole, theme, type Theme } from "./theme.js";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const COLOR_KEYS: (keyof Theme)[] = [
  "bg",
  "fg",
  "dim",
  "red",
  "green",
  "yellow",
  "orange",
  "purple",
  "cyan",
  "selectionBg",
  "accent",
  "bgMain",
  "bgSidebar",
  "border",
];

describe.each([
  ["monokaiPro", monokaiPro],
  ["monokaiClassic", monokaiClassic],
  ["sonicConsole", sonicConsole],
])("%s", (_name, palette) => {
  it("has a non-empty name", () => {
    expect(palette.name.length).toBeGreaterThan(0);
  });

  it("every color field is a valid 6-digit hex color", () => {
    for (const key of COLOR_KEYS) {
      expect(palette[key], `${key} should be a hex color`).toMatch(HEX_COLOR_RE);
    }
  });
});

describe("theme", () => {
  it("exports sonicConsole as the active theme", () => {
    expect(theme).toBe(sonicConsole);
  });
});
