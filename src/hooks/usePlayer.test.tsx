import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "./testHarness.js";
import type { MpvClient } from "../mpv.js";

const { resolveStreamUrl } = vi.hoisted(() => ({ resolveStreamUrl: vi.fn() }));
vi.mock("../ytdlp.js", () => ({ resolveStreamUrl }));

const { usePlayer } = await import("./usePlayer.js");

type FakePlayer = EventEmitter & {
  command: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
  togglePause: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
};

function makeFakePlayer(): FakePlayer {
  const emitter = new EventEmitter() as FakePlayer;
  emitter.command = vi.fn().mockResolvedValue(null);
  emitter.loadFile = vi.fn().mockResolvedValue(undefined);
  emitter.togglePause = vi.fn().mockResolvedValue(undefined);
  emitter.stop = vi.fn().mockResolvedValue(undefined);
  emitter.seek = vi.fn().mockResolvedValue(undefined);
  return emitter;
}

beforeEach(() => {
  resolveStreamUrl.mockReset();
});

describe("usePlayer", () => {
  it("starts idle with no track loaded", () => {
    const player = makeFakePlayer();
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    expect(result.current.status).toBe("idle");
    expect(result.current.videoId).toBeNull();
    expect(result.current.title).toBeNull();
  });

  it("play() goes loading -> playing, resolving the stream via yt-dlp then loading it into mpv", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/stream.m4a");
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));

    result.current.play("vid1", "My Track");
    expect(result.current.status).toBe("loading");
    expect(result.current.videoId).toBe("vid1");
    expect(result.current.title).toBe("My Track");

    await vi.waitFor(() => expect(result.current.status).toBe("playing"));
    expect(resolveStreamUrl).toHaveBeenCalledWith("vid1");
    expect(player.loadFile).toHaveBeenCalledWith("https://example.com/stream.m4a");
  });

  it("play() lands in 'error' status with a message when stream resolution fails", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockRejectedValue(new Error("yt-dlp failed"));
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));

    result.current.play("vid1", "My Track");
    await vi.waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("yt-dlp failed");
  });

  it("mpv's prop:pause event flips status between playing and paused", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.status).toBe("playing"));

    player.emit("prop:pause", true);
    await vi.waitFor(() => expect(result.current.status).toBe("paused"));

    player.emit("prop:pause", false);
    await vi.waitFor(() => expect(result.current.status).toBe("playing"));
  });

  it("ignores a prop:pause event that arrives while still 'loading'", () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockReturnValue(new Promise(() => {})); // never resolves - stays "loading"
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    expect(result.current.status).toBe("loading");

    player.emit("prop:pause", true);
    expect(result.current.status).toBe("loading");
  });

  it("an end-file event with reason 'eof' marks the track ended and clears position/duration", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    player.command.mockImplementation((args: unknown[]) => {
      const prop = args[1];
      if (prop === "time-pos") return Promise.resolve(10);
      if (prop === "duration") return Promise.resolve(200);
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.status).toBe("playing"));
    await vi.waitFor(() => expect(result.current.position).toBe(10));

    player.emit("end-file", { reason: "eof" });
    await vi.waitFor(() => expect(result.current.status).toBe("ended"));
    expect(result.current.position).toBeNull();
    expect(result.current.duration).toBeNull();
  });

  it("an end-file event with a non-eof reason (manual stop/quit/error) does not mark it ended", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.status).toBe("playing"));

    player.emit("end-file", { reason: "stop" });
    // Give it a turn of the microtask queue to (incorrectly) transition, if it were going to.
    await Promise.resolve();
    expect(result.current.status).toBe("playing");
  });

  it("togglePause() is a no-op while idle", () => {
    const player = makeFakePlayer();
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.togglePause();
    expect(player.togglePause).not.toHaveBeenCalled();
  });

  it("togglePause() forwards to mpv once something is loaded", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.status).toBe("playing"));

    result.current.togglePause();
    expect(player.togglePause).toHaveBeenCalled();
  });

  it("stop() resets all track state immediately and tells mpv to stop", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.status).toBe("playing"));

    result.current.stop();
    expect(player.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.videoId).toBeNull();
    expect(result.current.title).toBeNull();
    expect(result.current.position).toBeNull();
    expect(result.current.duration).toBeNull();
  });

  it("seekForward()/seekBackward() are no-ops while idle", () => {
    const player = makeFakePlayer();
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.seekForward();
    result.current.seekBackward();
    expect(player.seek).not.toHaveBeenCalled();
  });

  it("seekForward() optimistically advances position (clamped to duration) and tells mpv", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    player.command.mockImplementation((args: unknown[]) => {
      const prop = args[1];
      if (prop === "time-pos") return Promise.resolve(195);
      if (prop === "duration") return Promise.resolve(200);
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.position).toBe(195));

    result.current.seekForward();
    expect(player.seek).toHaveBeenCalledWith(10);
    // 195 + 10 = 205, clamped to duration (200).
    expect(result.current.position).toBe(200);
  });

  it("seekBackward() clamps at 0", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    player.command.mockImplementation((args: unknown[]) => {
      const prop = args[1];
      if (prop === "time-pos") return Promise.resolve(5);
      if (prop === "duration") return Promise.resolve(200);
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.position).toBe(5));

    result.current.seekBackward();
    expect(player.seek).toHaveBeenCalledWith(-10);
    expect(result.current.position).toBe(0);
  });

  it("ticks position forward locally by ~1s per second while actually playing", async () => {
    const player = makeFakePlayer();
    resolveStreamUrl.mockResolvedValue("https://example.com/a.m4a");
    player.command.mockImplementation((args: unknown[]) => {
      const prop = args[1];
      if (prop === "time-pos") return Promise.resolve(10);
      if (prop === "duration") return Promise.resolve(200);
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => usePlayer(player as unknown as MpvClient));
    result.current.play("vid1", "Track");
    await vi.waitFor(() => expect(result.current.position).toBe(10));

    await vi.waitFor(() => expect(result.current.position).toBeGreaterThan(10), { timeout: 2000 });
  });
});
