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

// Reconciliation only, not the primary driver of the displayed position anymore
// (see the local tick effect below) - tightening this alone (tried 1000ms then
// 500ms) still felt laggy, because every poll round-trips over the mpv IPC
// socket, and that latency doesn't go away just by polling more often. 2000ms
// is a real players' compromise: poll rarely for the authoritative time-pos/
// duration to drift-correct, while the local tick supplies the actual
// per-second smoothness.
const POSITION_POLL_MS = 2000;
// Ticks `position` forward locally once a second while playing, independent of
// the IPC poll's round-trip timing entirely - this is what actually makes the
// clock feel realtime (same technique real media players use: a local ticking
// clock reconciled periodically against the source of truth, not polling faster
// and faster hoping round-trip latency disappears).
const POSITION_TICK_MS = 1000;

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

  // Local realtime tick - only while actually playing (not paused, matching
  // mpv's own time-pos, which doesn't advance while paused either). Clamped to
  // `duration` when known so it can't tick past the end before the next
  // reconciling poll or the natural end-file event catches up.
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      setPosition((p) => (p === null ? p : duration !== null ? Math.min(duration, p + 1) : p + 1));
    }, POSITION_TICK_MS);
    return () => clearInterval(t);
  }, [status, duration]);

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
  // Seeking only sends mpv the command - the displayed position previously waited
  // for the NEXT scheduled poll tick (up to POSITION_POLL_MS later) to catch up,
  // which read as a real lag on every seek press. Update `position` optimistically
  // here so the progress bar/timestamp move instantly; the existing poll still
  // reconciles it against mpv's actual value shortly after (a network stream can
  // seek slightly differently than a flat +/-10s, so this is a fast estimate, not
  // the final source of truth).
  const seekForward = useCallback(() => {
    if (status === "idle") return;
    setPosition((p) => (p === null ? p : Math.min(duration ?? Infinity, p + 10)));
    player.seek(10).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [player, status, duration]);
  const seekBackward = useCallback(() => {
    if (status === "idle") return;
    setPosition((p) => (p === null ? p : Math.max(0, p - 10)));
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
