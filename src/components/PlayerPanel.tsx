import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { splitSubtitle } from "../library.js";
import type { UsePlayerResult } from "../hooks/usePlayer.js";
import type { UseQueueResult } from "../hooks/useQueue.js";

const ART_WIDTH = 16; // outer box width, including its 2-column single-line border
const ART_CONTENT_WIDTH = ART_WIDTH - 2;
const ART_HEIGHT = 4;
const ART_GLYPHS = ["░", "▒", "▓"];
// Previously every glyph shared one flat theme.border grey - against the near-black
// background that read as nearly invisible. Denser glyphs (▓) get a lighter shade so
// the pattern actually has visible contrast/variation, sparser glyphs (░) stay dimmer -
// approximating "opacity" the way a real placeholder thumbnail would, since terminals
// have no real alpha channel.
const ART_GLYPH_COLORS = [theme.border, "#666666", theme.dim];

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Cheap string hash so the same track always gets the same placeholder pattern. */
function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic (per track id, not random per render) ASCII placeholder in place of
 * real album art - no artwork data is fetched anywhere in this app. Rows are built at
 * ART_CONTENT_WIDTH (not the outer ART_WIDTH), since the single-line border already
 * consumes 2 of those columns - building at the outer width overflowed the interior
 * by 2 chars and wrapped the remainder onto a spurious extra line per row. */
function AlbumArt({ trackId }: { trackId: string | null }): React.ReactElement {
  const seed = hashOf(trackId ?? "idle");
  const rows: number[][] = [];
  for (let y = 0; y < ART_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < ART_CONTENT_WIDTH; x++) {
      row.push((seed + x * 7 + y * 13) % ART_GLYPHS.length);
    }
    rows.push(row);
  }
  const midRow = Math.floor(ART_HEIGHT / 2);
  return (
    <Box
      flexDirection="column"
      width={ART_WIDTH}
      borderStyle="single"
      borderColor={theme.border}
      paddingX={0}
    >
      {rows.map((row, i) =>
        i === midRow ? (
          <Text key={i} color={theme.dim} wrap="truncate-end">
            {"♫".padStart(Math.floor(ART_CONTENT_WIDTH / 2)).padEnd(ART_CONTENT_WIDTH)}
          </Text>
        ) : (
          <Box key={i}>
            {row.map((v, x) => (
              <Text key={x} color={ART_GLYPH_COLORS[v]}>
                {ART_GLYPHS[v]}
              </Text>
            ))}
          </Box>
        ),
      )}
    </Box>
  );
}

function ProgressBar({
  position,
  duration,
  width,
}: {
  position: number;
  duration: number;
  width: number;
}): React.ReactElement {
  const barWidth = Math.max(1, width);
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
  const filled = Math.round(ratio * barWidth);
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" width={barWidth}>
        <Text color={theme.dim}>{formatTime(position)}</Text>
        <Text color={theme.dim}>{formatTime(duration)}</Text>
      </Box>
      <Text>
        <Text color={theme.accent}>{"█".repeat(filled)}</Text>
        <Text color={theme.border}>{"█".repeat(Math.max(0, barWidth - filled))}</Text>
      </Text>
    </Box>
  );
}

export type FlashedControl = "prev" | "playPause" | "next" | null;

/** Both the flashed and idle style render the glyph with the same `" x "` padding -
 * only color/background/bold change - so a flash never resizes the row (a resize
 * mid-flash would shift the whole centered group, the same class of jitter this
 * component's centering has been bitten by before). */
function ControlIcon({ glyph, flashed }: { glyph: string; flashed: boolean }): React.ReactElement {
  return (
    <Text color={flashed ? theme.bg : theme.fg} backgroundColor={flashed ? theme.accent : undefined} bold={flashed}>
      {` ${glyph} `}
    </Text>
  );
}

/** Each icon is its own Box with marginRight for spacing (Yoga measures the actual
 * rendered width of each), rather than one joined string hand-padded with literal
 * spaces - that approach assumed every glyph renders at a known column width, which
 * doesn't hold for these Unicode media-control glyphs (some terminals render them
 * wide), and produced a control row that wasn't actually centered under the album
 * art / progress bar despite being wrapped in `justifyContent="center"`. No shuffle
 * or repeat glyph - both were mocked visual-only toggles with no real effect on
 * playback, which read as broken/misleading controls rather than decorative, so
 * they were removed entirely (`shuffleOn` earlier, `repeatOn` here) rather than kept
 * around unwired. The lime highlight is no longer permanently pinned to Play/Pause -
 * it flashes briefly on whichever icon's hotkey was actually just pressed
 * (`flashed`, driven by app.tsx's key handler), so the highlight genuinely
 * corresponds to a real keypress instead of always sitting on one button. */
function Controls({
  status,
  width,
  flashed,
}: {
  status: UsePlayerResult["status"];
  width: number;
  flashed: FlashedControl;
}): React.ReactElement {
  const playPauseGlyph = status === "playing" ? "⏸" : "▶";
  return (
    <Box justifyContent="center" width={width}>
      <Box marginRight={1}>
        <ControlIcon glyph="⏮" flashed={flashed === "prev"} />
      </Box>
      <ControlIcon glyph={playPauseGlyph} flashed={flashed === "playPause"} />
      <Box>
        <ControlIcon glyph="⏭" flashed={flashed === "next"} />
      </Box>
    </Box>
  );
}

export function PlayerPanel({
  playback,
  queue,
  width,
  flashedControl,
}: {
  playback: UsePlayerResult;
  queue: UseQueueResult;
  width: number;
  flashedControl: FlashedControl;
}): React.ReactElement {
  if (playback.status === "idle") {
    return (
      <Box flexDirection="column" flexGrow={1} width={width} alignItems="center" justifyContent="center">
        <Text color={theme.dim}>Nothing playing.</Text>
      </Box>
    );
  }

  const currentTrack = queue.tracks[queue.currentIndex];
  const { artist } = splitSubtitle(currentTrack?.subtitle);

  // flexGrow fills the full height the wrapping Panel gives this column (rather than
  // hugging content and leaving dead space below), justifyContent centers the whole
  // block of rows within that space instead of pinning everything to the top.
  return (
    <Box flexDirection="column" flexGrow={1} width={width} justifyContent="center">
      <Box justifyContent="center">
        <AlbumArt trackId={playback.videoId} />
      </Box>

      <Box justifyContent="center" width={width}>
        <Text color={theme.fg} bold wrap="truncate-end">
          {playback.title ?? ""}
        </Text>
      </Box>
      {artist && (
        <Box justifyContent="center" width={width}>
          <Text color={theme.dim} wrap="truncate-end">
            {artist}
          </Text>
        </Box>
      )}

      {playback.position !== null && playback.duration !== null && (
        <Box justifyContent="center" width={width} marginTop={1}>
          <ProgressBar position={playback.position} duration={playback.duration} width={width} />
        </Box>
      )}

      <Box justifyContent="center" width={width} marginTop={1}>
        <Controls status={playback.status} width={width} flashed={flashedControl} />
      </Box>

      {playback.error && (
        <Box justifyContent="center" marginTop={1}>
          <Text color={theme.red}>{playback.error}</Text>
        </Box>
      )}
    </Box>
  );
}
