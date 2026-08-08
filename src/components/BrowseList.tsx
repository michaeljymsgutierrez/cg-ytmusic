import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { windowFor } from "../window.js";
import { ICON } from "../icons.js";
import type { BrowseEntry, BrowseSection } from "../library.js";

export interface BrowseListProps {
  sections: BrowseSection[];
  /** Selection index into the flattened entry list (sections rendered in order). */
  selectedIndex: number;
  maxRows: number;
  width: number;
  /** Hide the subtitle column on narrower layouts. */
  showSubtitle?: boolean;
}

// A distinct icon for actual playable tracks (song/video) vs everything else
// (artist/album/playlist, all "things you navigate into" rather than play
// directly) - reinstated per-kind distinction now that Nerd Font icons render
// at a consistent weight/width, unlike the plain-Unicode glyphs that motivated
// collapsing this to one shared glyph earlier. Deliberately NOT the selection
// marker (also from icons.ts), so an unselected row can't be confused with a
// selected one.
const KIND_GLYPH: Record<BrowseEntry["kind"], string> = {
  song: ICON.music,
  video: ICON.music,
  playlist: ICON.list,
  artist: ICON.microphone,
  album: ICON.microphone,
  unknown: ICON.microphone,
};

interface FlatRow {
  kind: "header" | "entry";
  sectionTitle?: string;
  entry?: BrowseEntry;
}

function flatten(sections: BrowseSection[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const section of sections) {
    rows.push({ kind: "header", sectionTitle: section.title });
    for (const entry of section.entries) rows.push({ kind: "entry", entry });
  }
  return rows;
}

function fit(s: string, w: number): string {
  return s.length > w ? s.slice(0, Math.max(0, w - 1)) + "…" : s;
}

// Fixed-width cells: the selection-marker column, the one-glyph kind marker plus
// its trailing gap, and the subtitle. The title flexes to fill whatever is left.
const MARKER_WIDTH = 2;
// 2-space gap after the kind glyph, not 1 - matches Sidebar's fix for the same
// Nerd Font right-side-bearing issue (icon and title looked jammed together
// live with only 1 space).
const GLYPH_WIDTH = 3;
const SUBTITLE_WIDTH = 28;

function EntryRow({
  entry,
  selected,
  width,
  showSubtitle,
}: {
  entry: BrowseEntry;
  selected: boolean;
  width: number;
  showSubtitle: boolean;
}): React.ReactElement {
  const subtitleBudget = showSubtitle ? 1 + SUBTITLE_WIDTH : 0;
  const titleWidth = Math.max(10, width - MARKER_WIDTH - GLYPH_WIDTH - subtitleBudget);
  // True inversion for the active row (black text on lime), not just lime-colored text
  // on a dark background - every span in the row must switch to the inverted (bg) text
  // color when selected, or lime-on-lime would render invisible.
  const textColor = selected ? theme.bg : theme.fg;
  const dimColor = selected ? theme.bg : theme.dim;
  return (
    <Text backgroundColor={selected ? theme.accent : undefined} wrap="truncate-end">
      <Text color={textColor} bold>
        {selected ? `${ICON.chevronRight} ` : "  "}
      </Text>
      <Text color={dimColor}>{KIND_GLYPH[entry.kind] + "  "}</Text>
      <Text color={textColor} bold={selected}>
        {fit(entry.title, titleWidth).padEnd(titleWidth)}
      </Text>
      {showSubtitle && (
        <Text color={dimColor}>{" " + fit(entry.subtitle, SUBTITLE_WIDTH).padEnd(SUBTITLE_WIDTH)}</Text>
      )}
    </Text>
  );
}

export function BrowseList({
  sections,
  selectedIndex,
  maxRows,
  width,
  showSubtitle = true,
}: BrowseListProps): React.ReactElement {
  const totalEntries = sections.reduce((n, s) => n + s.entries.length, 0);
  if (totalEntries === 0) {
    return <Text color={theme.dim}>Nothing here.</Text>;
  }

  const rows = flatten(sections);
  // Reserve the last row for the position counter, matching cg-gh's List.tsx.
  const listRows = Math.max(1, maxRows - 1);

  // Selection only lands on "entry" rows; map selectedIndex (an entry-only index) to a
  // position in the flattened row list so section headers can be interleaved.
  let entryIndex = -1;
  let selectedRowIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind === "entry") {
      entryIndex++;
      if (entryIndex === selectedIndex) {
        selectedRowIndex = i;
        break;
      }
    }
  }

  const { start, end } = windowFor(rows.length, selectedRowIndex, listRows);
  const visible = rows.slice(start, end);

  let runningEntryIndex = rows.slice(0, start).filter((r) => r.kind === "entry").length - 1;

  return (
    <Box flexDirection="column">
      {visible.map((row, i) => {
        if (row.kind === "header") {
          return (
            <Text key={`h-${start + i}`} color={theme.dim} bold>
              {row.sectionTitle}
            </Text>
          );
        }
        runningEntryIndex++;
        return (
          <EntryRow
            key={`e-${start + i}`}
            entry={row.entry!}
            selected={runningEntryIndex === selectedIndex}
            width={width}
            showSubtitle={showSubtitle}
          />
        );
      })}
      {totalEntries > listRows && (
        <Text color={theme.dim}>{`${selectedIndex + 1}/${totalEntries}`}</Text>
      )}
    </Box>
  );
}
