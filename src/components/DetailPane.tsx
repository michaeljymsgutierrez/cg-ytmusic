import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import type { BrowseEntry } from "../library.js";

const KIND_LABEL: Record<BrowseEntry["kind"], string> = {
  song: "Song",
  video: "Video",
  playlist: "Playlist",
  artist: "Artist",
  album: "Album",
  unknown: "",
};

/** A read-out of the currently selected entry - full (untruncated) title, kind, and
 * its subtitle broken into separate lines (e.g. "Album • All Time Low • 2025" becomes
 * three lines) since the list column itself is too narrow to show all of that. */
export function DetailPane({ entry, width }: { entry: BrowseEntry | null; width: number }): React.ReactElement {
  if (!entry) {
    return <Text color={theme.dim}>Nothing selected.</Text>;
  }
  const parts = entry.subtitle.split(" • ").filter(Boolean);
  const kindLabel = KIND_LABEL[entry.kind];
  // The subtitle's own first segment is very often the kind spelled out already (e.g.
  // "Album • All Time Low • 2025") - only show the separate kind line when it isn't.
  const showKindLabel = kindLabel && parts[0]?.toLowerCase() !== kindLabel.toLowerCase();
  return (
    <Box flexDirection="column" width={width}>
      <Text color={theme.cyan} bold wrap="wrap">
        {entry.title}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {showKindLabel && <Text color={theme.dim}>{kindLabel}</Text>}
        {parts.map((part, i) => (
          <Text key={i} color={theme.fg} wrap="wrap">
            {part}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
