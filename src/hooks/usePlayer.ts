import { useCallback, useEffect, useState } from "react";
import type { MpvClient } from "../mpv.js";
import { resolveStreamUrl } from "../ytdlp.js";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface UsePlayerResult {
  status: PlayerStatus;
  videoId: string | null;
  title: string | null;
  /** Seconds into the current track; null until mpv reports one (e.g. while loading). */
  position: number | null;
  /** Total track length in seconds; null until mpv reports one. */
  duration: number | null;
  error: string | null;
  play: (videoId: string, title: string) => void;
  togglePause: () => void;
  stop: () => void;
  seekForward: () => void;
  seekBackward: () => void;
}

const POSITION_POLL_MS = 1000;

/** Wraps an MpvClient with React state: resolves a video id via yt-dlp, loads it into
 * mpv, and tracks status from mpv's own pause-property and end-file events. */
export function usePlayer(player: MpvClient): UsePlayerResult {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Modern mpv doesn't emit bare "pause"/"unpause" events - MpvClient normalizes the
    // "pause" property's observed changes into "prop:pause" (see mpv.ts) so this hook
    // doesn't need to know about mpv's observe_property plumbing.
    const onPauseChange = (isPaused: boolean) =>
      setStatus((s) => (s === "loading" ? s : isPaused ? "paused" : "playing"));
    // mpv fires end-file for manual stop/quit/error too, not just a track finishing
    // naturally - reason distinguishes them (confirmed live: "eof" vs "stop"). Only a
    // real "eof" should flip to "ended", since useQueue treats "ended" as the signal to
    // autoplay the next track; anything else already has its own status transition
    // (stop() sets "idle" itself, load-replace goes straight to the next "loading").
    const onEndFile = (msg: { reason?: string }) => {
      if (msg.reason !== "eof") return;
      setStatus("ended");
      setPosition(null);
      setDuration(null);
    };
    player.on("prop:pause", onPauseChange);
    player.on("end-file", onEndFile);
    return () => {
      player.off("prop:pause", onPauseChange);
      player.off("end-file", onEndFile);
    };
  }, [player]);

  // Poll position/duration while something is loaded - mpv only pushes these on
  // request, not as events, so periodic get_property is the simplest reliable option.
  useEffect(() => {
    if (status !== "playing" && status !== "paused") return;
    const poll = () => {
      Promise.all([player.command(["get_property", "time-pos"]), player.command(["get_property", "duration"])])
        .then(([pos, dur]) => {
          setPosition(typeof pos === "number" ? pos : null);
          setDuration(typeof dur === "number" ? dur : null);
        })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, POSITION_POLL_MS);
    return () => clearInterval(t);
  }, [player, status]);

  const play = useCallback(
    (id: string, trackTitle: string) => {
      setStatus("loading");
      setError(null);
      setVideoId(id);
      setTitle(trackTitle);
      resolveStreamUrl(id)
        .then((url) => player.loadFile(url))
        .then(() => setStatus("playing"))
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        });
    },
    [player],
  );

  // mpv rejects commands like seek/cycle-pause when nothing is loaded ("error running
  // command") - these all used to fire-and-forget with `void`, so that rejection was an
  // unhandled promise rejection that crashed the whole process (confirmed live: pressing
  // the seek key while idle killed the app). Guard the no-op case and catch the rest into
  // `error` instead of letting anything reject uncaught.
  const togglePause = useCallback(() => {
    if (status === "idle") return;
    player.togglePause().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [player, status]);
  const stop = useCallback(() => {
    player.stop().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    setStatus("idle");
    setVideoId(null);
    setTitle(null);
    setPosition(null);
    setDuration(null);
  }, [player]);
  const seekForward = useCallback(() => {
    if (status === "idle") return;
    player.seek(10).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [player, status]);
  const seekBackward = useCallback(() => {
    if (status === "idle") return;
    player.seek(-10).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [player, status]);

  return {
    status,
    videoId,
    title,
    position,
    duration,
    error,
    play,
    togglePause,
    stop,
    seekForward,
    seekBackward,
  };
}
