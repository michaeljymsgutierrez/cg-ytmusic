import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { theme } from "./theme.js";
import { useAuth } from "./hooks/useAuth.js";
import { usePlayer } from "./hooks/usePlayer.js";
import { useBrowse } from "./hooks/useBrowse.js";
import { useQueue } from "./hooks/useQueue.js";
import { CookiePrompt } from "./components/CookiePrompt.js";
import { BrowseList } from "./components/BrowseList.js";
import { NowPlaying, nowPlayingRows } from "./components/NowPlaying.js";
import { SearchInput } from "./components/SearchInput.js";
import {
  getArtistSections,
  getPlaylistTracks,
  playableEntries,
  queueFromSelection,
  searchMusic,
  type BrowseEntry,
  type QueueTrack,
} from "./library.js";
import type { MpvClient } from "./mpv.js";

export interface AppProps {
  version: string;
  player: MpvClient;
}

/** Rows the chrome always occupies besides the list: outer padding (2), header (1), the
 * margin above the list (1), the margin above the footer (1), and the footer itself (1).
 * The rule + now-playing pane only exist once signed in and now-playing's own height is
 * variable (1-3 rows depending on state), so those are added separately in render. */
const FIXED_CHROME_ROWS = 6;

/** Resolves what a "play all" (`p`) on a playlist/album/artist entry should queue - the
 * full tracklist for a playlist/album, or the first playable section (typically "Top
 * songs") for an artist. Empty for anything else. */
async function fetchPlayAllQueue(
  innertube: NonNullable<ReturnType<typeof useAuth>["innertube"]>,
  entry: BrowseEntry,
): Promise<QueueTrack[]> {
  if (!entry.id) return [];
  if (entry.kind === "playlist" || entry.kind === "album") {
    const tracks = await getPlaylistTracks(innertube, entry.id);
    return playableEntries(tracks).map((e) => ({ id: e.id!, title: e.title }));
  }
  if (entry.kind === "artist") {
    const sections = await getArtistSections(innertube, entry.id);
    const withSongs = sections.find((s) => playableEntries(s.entries).length > 0);
    return withSongs ? playableEntries(withSongs.entries).map((e) => ({ id: e.id!, title: e.title })) : [];
  }
  return [];
}

export function App({ version, player }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { status: authStatus, innertube, error: authError, submitCookie } = useAuth();
  const [cookieBuffer, setCookieBuffer] = useState("");
  const playback = usePlayer(player);
  const queue = useQueue(playback);
  const browse = useBrowse(authStatus === "signed-in" ? innertube : null);
  const [selected, setSelected] = useState(0);

  const [uiMode, setUiMode] = useState<"browse" | "search">("browse");
  const [searchBuffer, setSearchBuffer] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const entries = browse.view?.sections.flatMap((s) => s.entries) ?? [];

  useEffect(() => {
    setSelected((s) => (entries.length === 0 ? 0 : Math.min(s, entries.length - 1)));
  }, [entries.length]);

  const [, setResizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1);
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  useInput((input, key) => {
    if (authStatus === "needs-cookie") {
      if (key.return) {
        const cookie = cookieBuffer.trim();
        if (cookie) submitCookie(cookie);
        return;
      }
      if (key.backspace || key.delete) {
        setCookieBuffer((b) => b.slice(0, -1));
        return;
      }
      if (key.ctrl && input === "c") {
        exit();
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setCookieBuffer((b) => b + input);
      }
      return;
    }

    if (authStatus !== "signed-in") return;

    if (uiMode === "search") {
      if (key.escape) {
        setUiMode("browse");
        return;
      }
      if (key.return) {
        const query = searchBuffer.trim();
        if (!query || !innertube) return;
        setSearchLoading(true);
        setSearchError(null);
        searchMusic(innertube, query)
          .then((sections) => {
            browse.openResults(`Search: ${query}`, sections);
            setSearchLoading(false);
            setUiMode("browse");
          })
          .catch((e: unknown) => {
            setSearchError(e instanceof Error ? e.message : String(e));
            setSearchLoading(false);
          });
        return;
      }
      if (key.backspace || key.delete) {
        setSearchBuffer((b) => b.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchBuffer((b) => b + input);
      }
      return;
    }

    if (input === "q") {
      exit();
      return;
    }
    if (key.downArrow || input === "j") {
      setSelected((s) => Math.min(s + 1, Math.max(0, entries.length - 1)));
      return;
    }
    if (key.upArrow || input === "k") {
      setSelected((s) => Math.max(s - 1, 0));
      return;
    }
    if (input === "/") {
      setSearchBuffer("");
      setSearchError(null);
      setUiMode("search");
      return;
    }
    if (key.return) {
      const entry = entries[selected];
      if (!entry) return;
      if (entry.kind === "song" || entry.kind === "video") {
        const result = browse.view && queueFromSelection(browse.view.sections, selected);
        if (result) queue.playQueue(result.tracks, result.startIndex);
      } else {
        browse.open(entry);
      }
      return;
    }
    if (input === "p") {
      const entry = entries[selected];
      if (!entry || !innertube) return;
      fetchPlayAllQueue(innertube, entry).then((tracks) => {
        if (tracks.length > 0) queue.playQueue(tracks, 0);
      });
      return;
    }
    if ((key.backspace || key.delete || key.escape) && browse.canGoBack) {
      browse.goBack();
      return;
    }
    if (input === " ") {
      playback.togglePause();
      return;
    }
    if (input === "s") {
      playback.stop();
      return;
    }
    if (input === "f" || key.rightArrow) {
      playback.seekForward();
      return;
    }
    if (input === "b" || key.leftArrow) {
      playback.seekBackward();
    }
  });

  const termRows = process.stdout.rows ?? 24;
  const termCols = process.stdout.columns ?? 80;
  // Rule (1) + NowPlaying's actual height only apply once signed in.
  const nowPlayingChrome = authStatus === "signed-in" ? 1 + nowPlayingRows(playback) : 0;
  const maxRows = Math.max(1, termRows - FIXED_CHROME_ROWS - nowPlayingChrome);

  return (
    <Box flexDirection="column" height={termRows} width={termCols} padding={1} overflow="hidden">
      <Box justifyContent="space-between">
        <Text color={theme.green} bold>
          {uiMode === "search" ? "Search" : browse.view ? browse.view.title : "cg-ytmusic"}
        </Text>
        <Text color={theme.dim}>{`v${version}`}</Text>
      </Box>

      <Box marginTop={1} flexGrow={1} flexDirection="column" overflow="hidden">
        {authStatus === "checking" && <Text color={theme.yellow}>Checking saved sign-in...</Text>}

        {authStatus === "needs-cookie" && <CookiePrompt value={cookieBuffer} error={authError} />}

        {authStatus === "verifying" && <Text color={theme.yellow}>Verifying...</Text>}

        {authStatus === "signed-in" && uiMode === "search" && (
          <SearchInput value={searchBuffer} loading={searchLoading} error={searchError} />
        )}

        {authStatus === "signed-in" &&
          uiMode === "browse" &&
          (browse.loading && !browse.view ? (
            <Text color={theme.yellow}>Loading your library...</Text>
          ) : browse.error ? (
            <Text color={theme.red}>{`Error: ${browse.error}`}</Text>
          ) : browse.view ? (
            <BrowseList
              sections={browse.view.sections}
              selectedIndex={selected}
              maxRows={maxRows}
              width={termCols - 2}
            />
          ) : null)}
      </Box>

      {authStatus === "signed-in" && (
        <>
          <Text color={theme.dim}>{"─".repeat(Math.max(0, termCols - 2))}</Text>
          <NowPlaying playback={playback} queue={queue} />
        </>
      )}

      <Box marginTop={1}>
        <Text color={theme.dim}>
          {authStatus === "needs-cookie"
            ? "enter to submit, ctrl+c to quit"
            : uiMode === "search"
              ? "enter to search, esc to cancel"
              : "j/k move · enter select · p play all · / search · bksp back · space pause · f/b seek · s stop · q quit"}
        </Text>
      </Box>
    </Box>
  );
}
