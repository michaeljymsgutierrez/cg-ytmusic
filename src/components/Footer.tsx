import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface Hint {
  key: string;
  label: string;
}

/**
 * Greedily packs footer chips into rows no wider than `width` cells. Mirrors the
 * KeyHint box model: ` key ` (key.length + 2) + ` label` (label.length + 1) +
 * marginRight 2. The renderer and the height calc share this so reserved rows always
 * match what is drawn - ported from cg-gh's app.tsx.
 */
function packFooterRows(hints: Hint[], width: number): Hint[][] {
  const chipWidth = (h: Hint): number => h.key.length + h.label.length + 5;
  const rows: Hint[][] = [[]];
  let used = 0;
  for (const h of hints) {
    const w = chipWidth(h);
    if (used > 0 && width > 0 && used + w > width) {
      rows.push([h]);
      used = w;
    } else {
      rows[rows.length - 1].push(h);
      used += w;
    }
  }
  return rows;
}

/** Terminal rows the footer will occupy for these hints at this width - callers must
 * reserve exactly this many rows (see FIXED_CHROME_ROWS usage in app.tsx). */
export function footerLineCount(hints: Hint[], width: number): number {
  if (width <= 0) return 1;
  return packFooterRows(hints, width).length;
}

/** A keycap: the key on a highlighted chip, its action dimmed beside it. */
function KeyHint({ hint }: { hint: Hint }): React.ReactElement {
  return (
    <Box marginRight={2} flexShrink={0}>
      <Text backgroundColor={theme.selectionBg} color={theme.yellow} bold>
        {` ${hint.key} `}
      </Text>
      <Text color={theme.dim}>{` ${hint.label}`}</Text>
    </Box>
  );
}

export function Footer({ hints, width }: { hints: Hint[]; width: number }): React.ReactElement {
  const rows = packFooterRows(hints, width);
  return (
    <Box flexDirection="column">
      {rows.map((row, i) => (
        <Box key={i}>
          {row.map((h) => (
            <KeyHint key={h.key} hint={h} />
          ))}
        </Box>
      ))}
    </Box>
  );
}
