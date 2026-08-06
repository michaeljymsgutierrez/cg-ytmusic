import { useCallback, useEffect, useState } from "react";
import type { UsePlayerResult } from "./usePlayer.js";

export interface QueueTrack {
  id: string;
  title: string;
}

export interface UseQueueResult {
  tracks: QueueTrack[];
  /** -1 when nothing is queued. */
  currentIndex: number;
  /** Replaces the queue and starts playing at startIndex. */
  playQueue: (tracks: QueueTrack[], startIndex: number) => void;
  playNext: () => void;
  playPrev: () => void;
}

/** Owns the play queue and drives autoplay: when the current track ends, the next
 * queued track (if any) starts automatically via the same usePlayer instance. */
export function useQueue(playback: UsePlayerResult): UseQueueResult {
  const [tracks, setTracks] = useState<QueueTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const playAt = useCallback(
    (list: QueueTrack[], index: number) => {
      const track = list[index];
      if (!track) return;
      setCurrentIndex(index);
      playback.play(track.id, track.title);
    },
    [playback],
  );

  const playQueue = useCallback(
    (list: QueueTrack[], startIndex: number) => {
      setTracks(list);
      playAt(list, startIndex);
    },
    [playAt],
  );

  const playNext = useCallback(() => playAt(tracks, currentIndex + 1), [tracks, currentIndex, playAt]);
  const playPrev = useCallback(() => playAt(tracks, currentIndex - 1), [tracks, currentIndex, playAt]);

  useEffect(() => {
    if (playback.status !== "ended") return;
    if (currentIndex + 1 < tracks.length) playAt(tracks, currentIndex + 1);
  }, [playback.status, tracks, currentIndex, playAt]);

  return { tracks, currentIndex, playQueue, playNext, playPrev };
}
