import { describe, expect, it, vi } from "vitest";
import { renderHook } from "./testHarness.js";
import { useQueue, type QueueTrack } from "./useQueue.js";
import type { UsePlayerResult } from "./usePlayer.js";

function makePlayback(overrides: Partial<UsePlayerResult> = {}): UsePlayerResult {
  return {
    status: "idle",
    videoId: null,
    title: null,
    position: null,
    duration: null,
    error: null,
    play: vi.fn(),
    togglePause: vi.fn(),
    stop: vi.fn(),
    seekForward: vi.fn(),
    seekBackward: vi.fn(),
    ...overrides,
  };
}

const tracks: QueueTrack[] = [
  { id: "t1", title: "Track One" },
  { id: "t2", title: "Track Two" },
  { id: "t3", title: "Track Three" },
];

describe("useQueue", () => {
  it("starts empty with no current track", () => {
    const { result } = renderHook(() => useQueue(makePlayback()));
    expect(result.current.tracks).toEqual([]);
    expect(result.current.currentIndex).toBe(-1);
  });

  it("playQueue replaces the queue, sets currentIndex, and starts playback at startIndex", async () => {
    const playback = makePlayback();
    const { result, waitForNextUpdate } = renderHook(() => useQueue(playback));
    const next = waitForNextUpdate();
    result.current.playQueue(tracks, 1);
    await next;
    expect(result.current.tracks).toEqual(tracks);
    expect(result.current.currentIndex).toBe(1);
    expect(playback.play).toHaveBeenCalledWith("t2", "Track Two");
  });

  it("playNext advances to and plays the following track", async () => {
    const playback = makePlayback();
    const { result, waitForNextUpdate } = renderHook(() => useQueue(playback));
    const loaded = waitForNextUpdate();
    result.current.playQueue(tracks, 0);
    await loaded;

    const next = waitForNextUpdate();
    result.current.playNext();
    await next;
    expect(result.current.currentIndex).toBe(1);
    expect(playback.play).toHaveBeenCalledWith("t2", "Track Two");
  });

  it("playPrev moves back to and plays the previous track", async () => {
    const playback = makePlayback();
    const { result, waitForNextUpdate } = renderHook(() => useQueue(playback));
    const loaded = waitForNextUpdate();
    result.current.playQueue(tracks, 2);
    await loaded;

    const next = waitForNextUpdate();
    result.current.playPrev();
    await next;
    expect(result.current.currentIndex).toBe(1);
    expect(playback.play).toHaveBeenCalledWith("t2", "Track Two");
  });

  it("playNext past the end of the queue is a no-op (no track to play)", async () => {
    const playback = makePlayback();
    const { result, waitForNextUpdate } = renderHook(() => useQueue(playback));
    const loaded = waitForNextUpdate();
    result.current.playQueue(tracks, 2); // last track
    await loaded;
    (playback.play as ReturnType<typeof vi.fn>).mockClear();

    result.current.playNext();
    expect(result.current.currentIndex).toBe(2);
    expect(playback.play).not.toHaveBeenCalled();
  });

  it("playPrev before the start of the queue is a no-op", async () => {
    const playback = makePlayback();
    const { result, waitForNextUpdate } = renderHook(() => useQueue(playback));
    const loaded = waitForNextUpdate();
    result.current.playQueue(tracks, 0);
    await loaded;
    (playback.play as ReturnType<typeof vi.fn>).mockClear();

    result.current.playPrev();
    expect(result.current.currentIndex).toBe(0);
    expect(playback.play).not.toHaveBeenCalled();
  });

  it("autoplays the next track when playback status becomes 'ended'", async () => {
    const playback = makePlayback();
    const { result, rerender, waitForNextUpdate } = renderHook(() => useQueue(playback));
    const loaded = waitForNextUpdate();
    result.current.playQueue(tracks, 0);
    await loaded;
    (playback.play as ReturnType<typeof vi.fn>).mockClear();

    playback.status = "ended";
    const next = waitForNextUpdate();
    rerender();
    await next;

    expect(result.current.currentIndex).toBe(1);
    expect(playback.play).toHaveBeenCalledWith("t2", "Track Two");
  });

  it("does not autoplay past the last track when playback ends", async () => {
    const playback = makePlayback();
    const { result, rerender, waitForNextUpdate } = renderHook(() => useQueue(playback));
    const loaded = waitForNextUpdate();
    result.current.playQueue(tracks, 2); // last track
    await loaded;
    (playback.play as ReturnType<typeof vi.fn>).mockClear();

    playback.status = "ended";
    rerender();
    // Give any (incorrect) autoplay attempt a turn of the microtask queue to happen.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.currentIndex).toBe(2);
    expect(playback.play).not.toHaveBeenCalled();
  });
});
