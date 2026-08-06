import { useCallback, useEffect, useRef, useState } from "react";
import type { Innertube } from "youtubei.js";
import { getArtistSections, getLibrarySections, getPlaylistTracks, type BrowseEntry, type BrowseSection } from "../library.js";

export interface BrowseView {
  title: string;
  sections: BrowseSection[];
}

export interface UseBrowseResult {
  view: BrowseView | null;
  loading: boolean;
  error: string | null;
  canGoBack: boolean;
  /** Navigates into a playlist/album/artist entry; no-op for song/video entries (the
   * caller plays those directly instead of navigating). */
  open: (entry: BrowseEntry) => void;
  /** Pushes an already-fetched view (e.g. search results) onto the same stack. */
  openResults: (title: string, sections: BrowseSection[]) => void;
  goBack: () => void;
}

/** Drives the library -> playlist/artist detail navigation stack. The library root is
 * fetched once on mount; deeper views are fetched lazily as the user opens them. */
export function useBrowse(innertube: Innertube | null): UseBrowseResult {
  const [stack, setStack] = useState<BrowseView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!innertube || started.current) return;
    started.current = true;
    setLoading(true);
    getLibrarySections(innertube)
      .then((sections) => {
        setStack([{ title: "Library", sections }]);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [innertube]);

  const open = useCallback(
    (entry: BrowseEntry) => {
      if (!innertube || !entry.id) return;
      if (entry.kind === "playlist" || entry.kind === "album") {
        setLoading(true);
        setError(null);
        getPlaylistTracks(innertube, entry.id)
          .then((entries) => {
            setStack((s) => [...s, { title: entry.title, sections: [{ title: entry.title, entries }] }]);
            setLoading(false);
          })
          .catch((e: unknown) => {
            setError(e instanceof Error ? e.message : String(e));
            setLoading(false);
          });
      } else if (entry.kind === "artist") {
        setLoading(true);
        setError(null);
        getArtistSections(innertube, entry.id)
          .then((sections) => {
            setStack((s) => [...s, { title: entry.title, sections }]);
            setLoading(false);
          })
          .catch((e: unknown) => {
            setError(e instanceof Error ? e.message : String(e));
            setLoading(false);
          });
      }
    },
    [innertube],
  );

  const openResults = useCallback((title: string, sections: BrowseSection[]) => {
    setStack((s) => [...s, { title, sections }]);
  }, []);

  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  return {
    view: stack.length > 0 ? stack[stack.length - 1] : null,
    loading,
    error,
    canGoBack: stack.length > 1,
    open,
    openResults,
    goBack,
  };
}
