import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { windowFor } from "../window.js";
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

// Tree-view vocabulary: ▷ marks a "folder" (something you open into another view -
// artist/album), ≡ a playlist specifically, ♫ an actual playable track (song/video -
// not visually distinguished from each other, the spec doesn't call for that). "▷" is
// deliberately NOT the selection marker (▶, filled) - this is the hollow/outline
// variant, so an unselected folder row can't be confused with a selected one.
const KIND_GLYPH: Record<BrowseEntry["kind"], string> = {
  song: "♫",
  video: "♫",
  playlist: "≡",
  artist: "▷",
  album: "▷",
  unknown: "?",
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

// Fixed-width cells: the "❯ " / "  " selection marker, the one-glyph kind marker plus
// its trailing space, and the subtitle. The title flexes to fill whatever is left.
const MARKER_WIDTH = 2;
const GLYPH_WIDTH = 2;
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
        {selected ? "▶ " : "  "}
      </Text>
      <Text color={dimColor}>{KIND_GLYPH[entry.kind] + " "}</Text>
      <Text color={textColor} bold={selected}>
        {showSubtitle ? fit(entry.title, titleWidth).padEnd(titleWidth) : fit(entry.title, titleWidth)}
      </Text>
      {showSubtitle && <Text color={dimColor}>{" " + fit(entry.subtitle, SUBTITLE_WIDTH)}</Text>}
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
