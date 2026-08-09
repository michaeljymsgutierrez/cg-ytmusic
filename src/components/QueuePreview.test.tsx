import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { QueuePreview } from "./QueuePreview.js";
import type { UseQueueResult } from "../hooks/useQueue.js";

function makeQueue(overrides: Partial<UseQueueResult> = {}): UseQueueResult {
  return {
    tracks: [],
    currentIndex: -1,
    playQueue: () => {},
    playNext: () => {},
    playPrev: () => {},
    ...overrides,
  };
}

describe("QueuePreview", () => {
  it("shows a placeholder when the queue is empty", () => {
    const frame = render(<QueuePreview queue={makeQueue()} maxRows={5} width={30} />).lastFrame() ?? "";
    expect(frame).toBe("Queue is empty.");
  });

  it("renders numbered tracks with artist and duration split from the subtitle", () => {
    const queue = makeQueue({
      tracks: [
        { id: "t1", title: "Track 1", subtitle: "Artist A • 3:45" },
        { id: "t2", title: "Track 2" },
      ],
      currentIndex: 0,
    });
    const frame = render(<QueuePreview queue={queue} maxRows={5} width={30} />).lastFrame() ?? "";
    expect(frame).toBe(" 1. Track 1  Artist A     3:45\n 2. Track 2");
  });

  it("omits the artist/duration suffix entirely for a track with no subtitle", () => {
    const queue = makeQueue({ tracks: [{ id: "t1", title: "Solo Track" }], currentIndex: 0 });
    const frame = render(<QueuePreview queue={queue} maxRows={5} width={30} />).lastFrame() ?? "";
    expect(frame).toBe(" 1. Solo Track");
  });

  it("windows the list so the current track stays visible when the queue exceeds maxRows", () => {
    const tracks = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, title: `Track ${i + 1}` }));
    const queue = makeQueue({ tracks, currentIndex: 15 });
    const frame = render(<QueuePreview queue={queue} maxRows={5} width={30} />).lastFrame() ?? "";
    expect(frame).toContain("Track 16"); // currentIndex 15 -> "16." (1-indexed)
    expect(frame).not.toContain("Track 1\n"); // the very first track scrolled out of view
  });
});
