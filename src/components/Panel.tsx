import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface PanelProps {
  title: string;
  rightLabel?: string;
  width: number;
  color?: string;
  /** When true, the panel expands to fill remaining vertical space in its flex column
   * (border included) instead of hugging its content - for a main panel sitting above
   * a fixed-height panel (e.g. now-playing) that should stay pinned to the bottom. */
  grow?: boolean;
  /** Fixed total height (border rows included) - for panels sitting side-by-side in a
   * row, so their bottom borders all land on the same line instead of each hugging its
   * own (possibly different) content height. */
  height?: number;
  children: React.ReactNode;
}

function fit(s: string, w: number): string {
  return s.length > w ? s.slice(0, Math.max(0, w - 1)) + "…" : s;
}

/**
 * The top border line with an embedded title (and optional right-aligned label), e.g.
 * `┌─ Library ──────────────────────────────────────── v0.1.0 ─┐`. Exported for
 * testing - this is the fiddly part (has to line up character-for-character with the
 * plain `┌─┐│└─┘` border Ink itself draws for the rest of the panel via `borderStyle`).
 */
export function buildTopLine(title: string, rightLabel: string | undefined, width: number): string {
  const rightPart = rightLabel ? ` ${fit(rightLabel, Math.max(0, width - 8))} ─┐` : "─┐";
  const leftPrefix = "┌─ ";
  const titleBudget = Math.max(0, width - leftPrefix.length - 1 - rightPart.length);
  const leftPart = `${leftPrefix}${fit(title, titleBudget)} `;
  const fillCount = Math.max(0, width - leftPart.length - rightPart.length);
  return leftPart + "─".repeat(fillCount) + rightPart;
}

/**
 * A bordered panel with a title (and optional right-aligned label) embedded in the top
 * border, lazygit/k9s-style. Ink's `<Box borderStyle>` has no title support, so the top
 * line is hand-drawn and the box below has `borderTop={false}` to avoid drawing a
 * second one - `width` must be identical on both so the corners line up.
 */
export function Panel({
  title,
  rightLabel,
  width,
  color = theme.dim,
  grow = false,
  height,
  children,
}: PanelProps): React.ReactElement {
  // The hand-drawn top line is 1 row; when `height` is given, the bordered Box below
  // gets the remaining rows (height - 1) so the whole Panel's total height matches
  // exactly - it already omits its own top border (borderTop={false}) to avoid
  // drawing the line twice, but still draws its own bottom border row.
  const boxHeight = height !== undefined ? Math.max(1, height - 1) : undefined;
  return (
    <Box flexDirection="column" flexGrow={grow ? 1 : 0} height={height}>
      <Text color={color}>{buildTopLine(title, rightLabel, width)}</Text>
      <Box
        borderStyle="single"
        borderTop={false}
        borderColor={color}
        width={width}
        height={boxHeight}
        paddingX={1}
        flexDirection="column"
        flexGrow={grow ? 1 : 0}
      >
        {children}
      </Box>
    </Box>
  );
}
