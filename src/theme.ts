/**
 * Color themes for cg-ytmusic.
 *
 * Palettes are lifted verbatim from Ghostty's bundled Monokai theme files so the
 * TUI matches the terminal it runs in. Default is Monokai Pro; Monokai Classic is
 * exported as a drop-in swap (change the `theme` export at the bottom).
 */

export interface Theme {
  name: string;
  bg: string;
  fg: string;
  dim: string; // muted / secondary text
  red: string; // closed PR / danger
  green: string; // open
  yellow: string;
  orange: string;
  purple: string; // merged
  cyan: string;
  selectionBg: string;
  /** Single high-priority accent - active selection, progress fill, focus ring. */
  accent: string;
  /** Main content surface background. */
  bgMain: string;
  /** Sidebar/panel surface background (distinct from bgMain where Ink can paint it -
   * Ink only tints cells a <Text> actually writes to, so this isn't a guaranteed
   * full-bleed fill behind empty space). */
  bgSidebar: string;
  /** Structural border/divider color (kept separate from `dim`, which is body text). */
  border: string;
}

/** Ghostty "Monokai Pro". */
export const monokaiPro: Theme = {
  name: "Monokai Pro",
  bg: "#2d2a2e",
  fg: "#fcfcfa",
  dim: "#727072",
  red: "#ff6188",
  green: "#a9dc76",
  yellow: "#ffd866",
  orange: "#fc9867",
  purple: "#ab9df2",
  cyan: "#78dce8",
  selectionBg: "#5b595c",
  accent: "#a9dc76",
  bgMain: "#2d2a2e",
  bgSidebar: "#2d2a2e",
  border: "#727072",
};

/** Ghostty "Monokai Classic". */
export const monokaiClassic: Theme = {
  name: "Monokai Classic",
  bg: "#272822",
  fg: "#fdfff1",
  dim: "#6e7066",
  red: "#f92672",
  green: "#a6e22e",
  yellow: "#e6db74",
  orange: "#fd971f",
  purple: "#ae81ff",
  cyan: "#66d9ef",
  selectionBg: "#57584f",
  accent: "#a6e22e",
  bgMain: "#272822",
  bgSidebar: "#272822",
  border: "#6e7066",
};

/**
 * "Sonic Console": dark, high-contrast, monospaced, a single lime accent. Near-
 * monochrome by design, so the per-kind roles (green/cyan/yellow/orange/purple) are
 * graduated greys rather than Monokai's rainbow - kind is read off the glyph shape in
 * BrowseList, not a distinct hue per kind.
 */
export const sonicConsole: Theme = {
  name: "Sonic Console",
  bg: "#131313",
  fg: "#f5f5f5",
  dim: "#9a9a9a",
  red: "#ff5c5c",
  green: "#ccff00",
  yellow: "#ccff00",
  orange: "#c9c9c9",
  purple: "#dcdcdc",
  cyan: "#e0e0e0",
  selectionBg: "#1f1f1f",
  accent: "#ccff00",
  bgMain: "#131313",
  bgSidebar: "#0e0e0e",
  border: "#393939",
};

/** Active theme. Swap to `monokaiPro`/`monokaiClassic` to go back to the old look. */
export const theme: Theme = sonicConsole;
