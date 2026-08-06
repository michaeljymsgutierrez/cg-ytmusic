import { execa } from "execa";

/** Resolves a YouTube video id to a direct, playable audio-only stream URL via yt-dlp. */
export async function resolveStreamUrl(videoId: string): Promise<string> {
  const { stdout } = await execa("yt-dlp", [
    "--no-playlist",
    "-f",
    "bestaudio[ext=m4a]/bestaudio",
    "-g",
    `https://music.youtube.com/watch?v=${videoId}`,
  ]);
  const url = stdout.trim().split("\n")[0];
  if (!url) throw new Error(`yt-dlp returned no stream URL for video ${videoId}`);
  return url;
}
