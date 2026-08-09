import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { PlayerPanel } from "./PlayerPanel.js";
import { ICON } from "../icons.js";
import type { UsePlayerResult } from "../hooks/usePlayer.js";
import type { UseQueueResult } from "../hooks/useQueue.js";

function playback(overrides: Partial<UsePlayerResult> = {}): UsePlayerResult {
  return {
    status: "idle",
    videoId: null,
    title: null,
    position: null,
    duration: null,
    error: null,
    play: () => {},
    togglePause: () => {},
    stop: () => {},
    seekForward: () => {},
    seekBackward: () => {},
    ...overrides,
  };
}

function makeQueue(overrides: Partial<UseQueueResult> = {}): UseQueueResult {
  return { tracks: [], currentIndex: -1, playQueue: () => {}, playNext: () => {}, playPrev: () => {}, ...overrides };
}

/** Mirrors Controls' manual-centering math in PlayerPanel.tsx (CONTROLS_CONTENT_WIDTH=11)
 * so tests don't have to hardcode a pad count that would silently drift from the source. */
function expectedControlsRow(playPauseGlyph: string, width: number): string {
  const leftPad = Math.max(0, Math.floor((width - 11) / 2));
  return (
    " ".repeat(leftPad) +
    ` ${ICON.stepBackward} ` +
    " " +
    ` ${playPauseGlyph} ` +
    " " +
    ` ${ICON.stepForward} `
  ).trimEnd();
}

describe("PlayerPanel", () => {
  it("shows a centered placeholder when idle", () => {
    const frame = render(<PlayerPanel playback={playback()} queue={makeQueue()} width={22} height={20} flashedControl={null} />).lastFrame() ?? "";
    expect(frame).toBe("   Nothing playing.");
  });

  it("renders the album art frame, title, and artist while playing (no position/duration yet)", () => {
    const pb = playback({ status: "playing", videoId: "v1", title: "My Track" });
    const q = makeQueue({ tracks: [{ id: "v1", title: "My Track", subtitle: "Some Artist • 3:00" }], currentIndex: 0 });
    const frame = render(<PlayerPanel playback={pb} queue={q} width={22} height={20} flashedControl={null} />).lastFrame() ?? "";
    const lines = frame.split("\n");

    expect(lines[0]).toBe("┌" + "─".repeat(20) + "┐");
    // Bottom border, title, artist, then a blank line (Controls' own marginTop) before Controls.
    expect(lines.at(-5)).toBe("└" + "─".repeat(20) + "┘");
    expect(lines.at(-4)).toBe("       My Track");
    expect(lines.at(-3)).toBe("     Some Artist");
    expect(lines.at(-2)).toBe("");
    // No progress bar (position/duration still null) - controls sit right after the artist line.
    expect(lines.at(-1)).toBe(expectedControlsRow(ICON.pause, 22));
  });

  it("shows the pause glyph while playing and the play glyph otherwise", () => {
    const q = makeQueue({ tracks: [{ id: "v1", title: "Track" }], currentIndex: 0 });

    const playingFrame =
      render(<PlayerPanel playback={playback({ status: "playing", videoId: "v1", title: "Track" })} queue={q} width={22} height={20} flashedControl={null} />).lastFrame() ?? "";
    expect(playingFrame.split("\n").at(-1)).toBe(expectedControlsRow(ICON.pause, 22));

    const pausedFrame =
      render(<PlayerPanel playback={playback({ status: "paused", videoId: "v1", title: "Track" })} queue={q} width={22} height={20} flashedControl={null} />).lastFrame() ?? "";
    expect(pausedFrame.split("\n").at(-1)).toBe(expectedControlsRow(ICON.play, 22));
  });

  it("renders a progress bar with formatted timestamps once position/duration are known", () => {
    const pb = playback({ status: "playing", videoId: "v1", title: "My Track", position: 65, duration: 200 });
    const q = makeQueue({ tracks: [{ id: "v1", title: "My Track", subtitle: "Some Artist • 3:00" }], currentIndex: 0 });
    const frame = render(<PlayerPanel playback={pb} queue={q} width={22} height={20} flashedControl={null} />).lastFrame() ?? "";
    const lines = frame.split("\n");

    // formatTime(65) = "1:05", formatTime(200) = "3:20".
    const timestampLine = lines.find((l) => l.includes("1:05") && l.includes("3:20"));
    expect(timestampLine).toBeDefined();
    const barLine = lines[lines.indexOf(timestampLine!) + 1];
    // ratio = 65/200 = 0.325, filled = round(0.325 * 22) = 7.
    expect(barLine).toBe("█".repeat(7) + "█".repeat(15));
  });

  it("omits the artist line entirely when the current track has no subtitle", () => {
    const pb = playback({ status: "playing", videoId: "v1", title: "Solo Track" });
    const q = makeQueue({ tracks: [{ id: "v1", title: "Solo Track" }], currentIndex: 0 });
    const frame = render(<PlayerPanel playback={pb} queue={q} width={22} height={20} flashedControl={null} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines.at(-1)).toBe(expectedControlsRow(ICON.pause, 22));
    expect(lines.at(-2)).toBe(""); // Controls' own marginTop, with no artist line above it
    expect(frame).not.toContain("Artist");
  });

  it("shows the playback error message when one is set", () => {
    const pb = playback({ status: "error", videoId: "v1", title: "Track", error: "stream failed" });
    const q = makeQueue({ tracks: [{ id: "v1", title: "Track" }], currentIndex: 0 });
    const frame = render(<PlayerPanel playback={pb} queue={q} width={22} height={20} flashedControl={null} />).lastFrame() ?? "";
    // Centered within width=22: "stream failed" is 13 chars, so 4 spaces pad each side (trailing trimmed).
    expect(frame.split("\n").at(-1)).toBe("    stream failed");
  });
});
