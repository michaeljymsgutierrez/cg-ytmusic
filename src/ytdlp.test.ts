import { beforeEach, describe, expect, it, vi } from "vitest";

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock("execa", () => ({ execa }));

const { resolveStreamUrl } = await import("./ytdlp.js");

beforeEach(() => {
  execa.mockReset();
});

describe("resolveStreamUrl", () => {
  it("resolves to the trimmed stream URL from yt-dlp's stdout", async () => {
    execa.mockResolvedValue({ stdout: "https://example.com/stream.m4a\n" });
    await expect(resolveStreamUrl("videoId123")).resolves.toBe("https://example.com/stream.m4a");
  });

  it("calls yt-dlp with the expected flags and the correct watch URL", async () => {
    execa.mockResolvedValue({ stdout: "https://example.com/stream.m4a" });
    await resolveStreamUrl("videoId123");
    expect(execa).toHaveBeenCalledWith("yt-dlp", [
      "--no-playlist",
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
      "-g",
      "https://music.youtube.com/watch?v=videoId123",
    ]);
  });

  it("takes only the first line when yt-dlp prints multiple URLs", async () => {
    execa.mockResolvedValue({ stdout: "https://example.com/first.m4a\nhttps://example.com/second.m4a" });
    await expect(resolveStreamUrl("videoId123")).resolves.toBe("https://example.com/first.m4a");
  });

  it("throws when yt-dlp returns no stream URL", async () => {
    execa.mockResolvedValue({ stdout: "" });
    await expect(resolveStreamUrl("videoId123")).rejects.toThrow("yt-dlp returned no stream URL for video videoId123");
  });

  it("propagates a rejection from execa (e.g. yt-dlp exiting non-zero)", async () => {
    execa.mockRejectedValue(new Error("yt-dlp exited with code 1"));
    await expect(resolveStreamUrl("videoId123")).rejects.toThrow("yt-dlp exited with code 1");
  });
});
