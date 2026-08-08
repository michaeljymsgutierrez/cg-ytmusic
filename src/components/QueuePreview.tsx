import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { windowFor } from "../window.js";
import { splitSubtitle } from "../library.js";
import type { UseQueueResult } from "../hooks/useQueue.js";

function fit(s: string, w: number): string {
  return s.length > w ? s.slice(0, Math.max(0, w - 1)) + "…" : s;
}

export function QueuePreview({
  queue,
  maxRows,
  width,
}: {
  queue: UseQueueResult;
  maxRows: number;
  width: number;
}): React.ReactElement {
  if (queue.tracks.length === 0) {
    return <Text color={theme.dim}>Queue is empty.</Text>;
  }

  const { start, end } = windowFor(queue.tracks.length, queue.currentIndex, Math.max(1, maxRows));
  const visible = queue.tracks.slice(start, end);

  return (
    <Box flexDirection="column" width={width}>
      {visible.map((track, i) => {
        const index = start + i;
        const current = index === queue.currentIndex;
        const { artist, duration } = splitSubtitle(track.subtitle);
        // Fixed-width single Text (not a flex row of two children) so a long title
        // can't overflow into the duration column - matches BrowseList's EntryRow
        // budget approach, which the same overflow bug bit before this restyle.
        const durationBudget = duration ? duration.length + 1 : 0;
        const labelWidth = Math.max(5, width - durationBudget);
        const label = `${index + 1}  ${track.title}${artist ? `  ${artist}` : ""}`;
        // True inversion for the current track (black text on lime), matching
        // BrowseList's selected-row treatment - not just accent-colored text.
        return (
          <Text
            key={`${track.id}-${index}`}
            backgroundColor={current ? theme.accent : undefined}
            color={current ? theme.bg : theme.fg}
            bold={current}
          >
            {fit(label, labelWidth).padEnd(labelWidth)}
            {duration && <Text color={current ? theme.bg : theme.dim}>{` ${duration}`}</Text>}
          </Text>
        );
      })}
    </Box>
  );
}
