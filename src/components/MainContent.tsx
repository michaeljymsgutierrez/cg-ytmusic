import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { BrowseList } from "./BrowseList.js";
import { QueuePreview } from "./QueuePreview.js";
import type { BrowseView } from "../hooks/useBrowse.js";
import type { UseQueueResult } from "../hooks/useQueue.js";
import type { Section } from "./Sidebar.js";

/** Rows of upcoming tracks shown in the Queue Preview stacked under Library (a fuller
 * queue view lives behind the Queue sidebar item instead). */
const STACKED_QUEUE_ROWS = 3;
const STACKED_QUEUE_HEADER_ROWS = 2; // marginTop(1) + "QUEUE" label(1)

/** Rows this component reserves beyond the primary list/queue rows it's given -
 * mirrors nowPlayingRows()/footerLineCount() so callers can compute an exact
 * maxRows budget instead of guessing (this project has hit that exact class of bug
 * more than once). The wrapping Panel's border now carries the section title, so
 * there's no separate in-content header row to account for here anymore. */
export function mainContentChrome(section: Section, queueLength: number): number {
  return section === "library" && queueLength > 0 ? STACKED_QUEUE_HEADER_ROWS + STACKED_QUEUE_ROWS : 0;
}

export function MainContent({
  section,
  browseView,
  browseLoading,
  browseError,
  selected,
  queue,
  maxRows,
  width,
}: {
  section: Section;
  browseView: BrowseView | null;
  browseLoading: boolean;
  browseError: string | null;
  selected: number;
  queue: UseQueueResult;
  maxRows: number;
  width: number;
}): React.ReactElement {
  if (section === "queue") {
    return <QueuePreview queue={queue} maxRows={Math.max(1, maxRows)} width={width} />;
  }

  if (browseLoading && !browseView) {
    return <Text color={theme.yellow}>Loading...</Text>;
  }
  if (browseError) {
    return <Text color={theme.red}>{`Error: ${browseError}`}</Text>;
  }
  if (!browseView) {
    return <Text color={theme.dim}>Nothing here.</Text>;
  }

  const showStackedQueue = section === "library" && queue.tracks.length > 0;
  const listRows = Math.max(1, maxRows - (showStackedQueue ? STACKED_QUEUE_HEADER_ROWS + STACKED_QUEUE_ROWS : 0));

  return (
    <Box flexDirection="column" width={width}>
      <BrowseList sections={browseView.sections} selectedIndex={selected} maxRows={listRows} width={width} />
      {showStackedQueue && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.dim} bold>
            QUEUE
          </Text>
          <QueuePreview queue={queue} maxRows={STACKED_QUEUE_ROWS} width={width} />
        </Box>
      )}
    </Box>
  );
}
