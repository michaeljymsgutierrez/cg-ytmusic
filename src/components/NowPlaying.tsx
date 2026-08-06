import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import type { UsePlayerResult } from "../hooks/usePlayer.js";
import type { UseQueueResult } from "../hooks/useQueue.js";

const STATUS_ICON: Record<UsePlayerResult["status"], string> = {
  idle: "",
  loading: "…",
  playing: "▶",
  paused: "⏸",
  ended: "■",
  error: "✕",
};

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const BAR_WIDTH = 20;

function ProgressBar({ position, duration }: { position: number; duration: number }): React.ReactElement {
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
  const filled = Math.round(ratio * BAR_WIDTH);
  return (
    <Text>
      <Text color={theme.dim}>{`${formatTime(position)} `}</Text>
      <Text color={theme.green}>{"─".repeat(filled)}</Text>
      <Text color={theme.dim}>{"─".repeat(Math.max(0, BAR_WIDTH - filled))}</Text>
      <Text color={theme.dim}>{` ${formatTime(duration)}`}</Text>
    </Text>
  );
}

/** Terminal rows NowPlaying will render for a given state - kept in sync with the JSX
 * below so callers can reserve exactly enough space (mirrors cg-gh's footerLineCount). */
export function nowPlayingRows(playback: UsePlayerResult): number {
  if (playback.status === "idle") return 1;
  let rows = 1;
  if (playback.position !== null && playback.duration !== null) rows += 1;
  if (playback.error) rows += 1;
  return rows;
}

export function NowPlaying({
  playback,
  queue,
}: {
  playback: UsePlayerResult;
  queue: UseQueueResult;
}): React.ReactElement {
  if (playback.status === "idle") {
    return <Text color={theme.dim}>Nothing playing.</Text>;
  }
  const color = playback.status === "error" ? theme.red : theme.fg;
  const queueLabel =
    queue.tracks.length > 1 ? `  (${queue.currentIndex + 1}/${queue.tracks.length} queued)` : "";
  return (
    <Box flexDirection="column">
      <Text color={color}>
        <Text color={theme.cyan}>{STATUS_ICON[playback.status]}</Text>
        {playback.title ? `  ${playback.title}` : ""}
        <Text color={theme.dim}>{queueLabel}</Text>
      </Text>
      {playback.position !== null && playback.duration !== null && (
        <ProgressBar position={playback.position} duration={playback.duration} />
      )}
      {playback.error && <Text color={theme.red}>{playback.error}</Text>}
    </Box>
  );
}
