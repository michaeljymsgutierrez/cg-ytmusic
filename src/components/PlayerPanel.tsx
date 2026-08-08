import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { splitSubtitle } from "../library.js";
import type { UsePlayerResult } from "../hooks/usePlayer.js";
import type { UseQueueResult } from "../hooks/useQueue.js";

const ART_WIDTH = 16; // outer box width, including its 2-column single-line border
const ART_CONTENT_WIDTH = ART_WIDTH - 2;
const ART_HEIGHT = 4;
const ART_GLYPHS = ["░", "▒", "▓"];
const VISUALIZER_ROWS = 3;
// Ink redraws the ENTIRE frame (clear+rewrite, not a granular terminal diff) on every
// state change, so this tick rate directly sets how often the whole screen flickers.
// 200ms (5 redraws/sec) was visibly flickery for a purely decorative animation.
const VISUALIZER_TICK_MS = 600;

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
  const rows: string[] = [];
  for (let y = 0; y < ART_HEIGHT; y++) {
    let row = "";
    for (let x = 0; x < ART_CONTENT_WIDTH; x++) {
      const v = (seed + x * 7 + y * 13) % ART_GLYPHS.length;
      row += ART_GLYPHS[v];
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
      {rows.map((row, i) => (
        <Text key={i} color={theme.border} wrap="truncate-end">
          {i === midRow
            ? "♫".padStart(Math.floor(ART_CONTENT_WIDTH / 2)).padEnd(ART_CONTENT_WIDTH)
            : row}
        </Text>
      ))}
    </Box>
  );
}

// Braille dot bits: Unicode braille cells pack an 8-dot, 2 (col) x 4 (row) grid per
// character - DOT_BIT[localRow][colInCell] gives the bit for that dot. Plotting a
// waveform at this sub-cell resolution (not whole block characters) is what makes an
// oscilloscope trace look smooth: 4x the vertical resolution and 2x the horizontal
// resolution of a block-character bar chart in the same terminal space, and every
// terminal column maps to exactly one braille cell - no bar-width/gap/exact-fill
// math needed at all (the entire class of margin bugs the old bar chart kept hitting
// simply doesn't exist here).
const BRAILLE_BASE = 0x2800;
const DOT_BIT = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

// Maps mpv's real RMS loudness (dB, roughly -45 quiet to 0 loudest) onto an
// amplitude multiplier. Floored at 0.15 rather than 0 so the trace never goes
// perfectly flat during a quiet passage - it should read as "quiet", not "no
// signal" (that's what the paused/stopped flat line already means).
const AUDIO_LEVEL_FLOOR_DB = -45;
const AMPLITUDE_FLOOR = 0.15;

function levelToAmplitudeFactor(level: number | null): number {
  if (level === null) return 1;
  const t = Math.max(0, Math.min(1, (level - AUDIO_LEVEL_FLOOR_DB) / -AUDIO_LEVEL_FLOOR_DB));
  return AMPLITUDE_FLOOR + t * (1 - AMPLITUDE_FLOOR);
}

/** An oscilloscope-style waveform trace, not a spectrum bar chart - a continuous
 * line (a moving two-frequency sine blend while playing, a flat dead-centered line
 * when paused/stopped, matching how a real scope shows no signal) plotted at
 * braille sub-cell resolution. `level` is mpv's real RMS loudness (see
 * usePlayer's audioLevel / mpv.ts's getAudioLevel) - when available, it scales the
 * trace's amplitude to the track's actual current volume, so louder passages
 * visibly swing wider than quiet ones. The wave's SHAPE stays synthetic either way
 * (a two-frequency sine blend, not real waveform/spectrum data - see the "is it
 * adaptive to audio" discussion this was built from: getting real per-sample or
 * per-frequency data would mean bypassing mpv's audio pipeline entirely, a much
 * bigger change than this app's architecture warrants). Falls back to a fixed full
 * amplitude when `level` is null (unsupported mpv build, or nothing loaded yet). */
function Visualizer({
  active,
  width,
  level,
}: {
  active: boolean;
  width: number;
  level: number | null;
}): React.ReactElement {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), VISUALIZER_TICK_MS);
    return () => clearInterval(t);
  }, [active]);

  const cols = Math.max(1, width);
  const subCols = cols * 2;
  const subRows = VISUALIZER_ROWS * 4;
  const mid = (subRows - 1) / 2;
  const amplitude = mid * 0.85 * levelToAmplitudeFactor(active ? level : null);

  const ySamples = Array.from({ length: subCols }, (_, x) => {
    if (!active) return mid;
    const wave = Math.sin(tick / 2 + x * 0.35) + Math.sin(tick / 5 + x * 0.12) * 0.4;
    return mid - wave * (amplitude / 1.4);
  });

  const grid: number[][] = Array.from({ length: VISUALIZER_ROWS }, () => new Array(cols).fill(0));
  const plotDot = (subCol: number, subRow: number) => {
    const r = Math.max(0, Math.min(subRows - 1, Math.round(subRow)));
    const cellCol = Math.floor(subCol / 2);
    if (cellCol < 0 || cellCol >= cols) return;
    grid[Math.floor(r / 4)][cellCol] |= DOT_BIT[r % 4][subCol % 2];
  };

  // One dot per sub-column, not a vertical fill connecting each sample to the last -
  // filling the whole gap between two points made steep sections of the wave render
  // as thick filled blocks rather than a thin line. The per-step slope here is small
  // enough (frequencies chosen deliberately low) that single dots still read as a
  // continuous trace.
  for (let x = 0; x < subCols; x++) plotDot(x, ySamples[x]);

  const color = active ? theme.accent : theme.border;
  return (
    <Box flexDirection="column">
      {grid.map((row, r) => (
        <Text key={r} color={color}>
          {row.map((bits) => String.fromCharCode(BRAILLE_BASE + bits)).join("")}
        </Text>
      ))}
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

/** Each icon is its own Box with marginRight for spacing (Yoga measures the actual
 * rendered width of each), rather than one joined string hand-padded with literal
 * spaces - that approach assumed every glyph renders at a known column width, which
 * doesn't hold for these Unicode media-control glyphs (some terminals render them
 * wide), and produced a control row that wasn't actually centered under the album
 * art / progress bar despite being wrapped in `justifyContent="center"`. No shuffle
 * or repeat glyph - both were mocked visual-only toggles with no real effect on
 * playback, which read as broken/misleading controls rather than decorative, so
 * they were removed entirely (`shuffleOn` earlier, `repeatOn` here) rather than kept
 * around unwired. */
function Controls({ status, width }: { status: UsePlayerResult["status"]; width: number }): React.ReactElement {
  const playPauseGlyph = status === "playing" ? "⏸" : "▶";
  return (
    <Box justifyContent="center" width={width}>
      <Box marginRight={3}>
        <Text color={theme.fg}>⏮</Text>
      </Box>
      <Text color={theme.bg} backgroundColor={theme.accent} bold>
        {` ${playPauseGlyph} `}
      </Text>
      <Box marginLeft={3}>
        <Text color={theme.fg}>⏭</Text>
      </Box>
    </Box>
  );
}

export function PlayerPanel({
  playback,
  queue,
  width,
}: {
  playback: UsePlayerResult;
  queue: UseQueueResult;
  width: number;
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
  const isPlaying = playback.status === "playing";

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

      <Box justifyContent="center" width={width} marginTop={1}>
        <Visualizer active={isPlaying} width={width} level={playback.audioLevel} />
      </Box>

      {playback.position !== null && playback.duration !== null && (
        <Box justifyContent="center" width={width} marginTop={1}>
          <ProgressBar position={playback.position} duration={playback.duration} width={width} />
        </Box>
      )}

      <Box marginTop={1}>
        <Controls status={playback.status} width={width} />
      </Box>

      {playback.error && (
        <Box justifyContent="center" marginTop={1}>
          <Text color={theme.red}>{playback.error}</Text>
        </Box>
      )}
    </Box>
  );
}
