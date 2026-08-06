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
}

const KIND_GLYPH: Record<BrowseEntry["kind"], string> = {
  song: "♪",
  video: "▶",
  playlist: "≡",
  artist: "★",
  album: "◆",
  unknown: "?",
};

const KIND_COLOR: Record<BrowseEntry["kind"], string> = {
  song: theme.green,
  video: theme.cyan,
  playlist: theme.yellow,
  artist: theme.purple,
  album: theme.orange,
  unknown: theme.dim,
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
}: {
  entry: BrowseEntry;
  selected: boolean;
  width: number;
}): React.ReactElement {
  const titleWidth = Math.max(10, width - MARKER_WIDTH - GLYPH_WIDTH - 1 - SUBTITLE_WIDTH);
  return (
    <Text backgroundColor={selected ? theme.selectionBg : undefined} wrap="truncate-end">
      <Text color={theme.green} bold>
        {selected ? "❯ " : "  "}
      </Text>
      <Text color={KIND_COLOR[entry.kind]}>{KIND_GLYPH[entry.kind] + " "}</Text>
      <Text color={selected ? theme.cyan : theme.fg} bold={selected}>
        {fit(entry.title, titleWidth).padEnd(titleWidth)}
      </Text>
      <Text color={theme.dim}>{" " + fit(entry.subtitle, SUBTITLE_WIDTH)}</Text>
    </Text>
  );
}

export function BrowseList({ sections, selectedIndex, maxRows, width }: BrowseListProps): React.ReactElement {
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
          />
        );
      })}
      {totalEntries > listRows && (
        <Text color={theme.dim}>{`${selectedIndex + 1}/${totalEntries}`}</Text>
      )}
    </Box>
  );
}
