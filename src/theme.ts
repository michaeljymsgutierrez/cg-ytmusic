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
};

/** Active theme. Swap to `monokaiClassic` for the classic olive-background look. */
export const theme: Theme = monokaiPro;
