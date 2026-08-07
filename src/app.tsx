import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { theme } from "./theme.js";
import { useAuth } from "./hooks/useAuth.js";
import { usePlayer } from "./hooks/usePlayer.js";
import { useBrowse } from "./hooks/useBrowse.js";
import { useQueue } from "./hooks/useQueue.js";
import { CookiePrompt } from "./components/CookiePrompt.js";
import { BrowseList } from "./components/BrowseList.js";
import { DetailPane } from "./components/DetailPane.js";
import { NowPlaying, nowPlayingRows } from "./components/NowPlaying.js";
import { SearchInput } from "./components/SearchInput.js";
import { Panel } from "./components/Panel.js";
import { Footer, footerLineCount, type Hint } from "./components/Footer.js";
import {
  getArtistSections,
  getHomeSections,
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

/** Rows the chrome always occupies besides any panel's own content: outer padding (2)
 * and the margin above the footer (1). The footer's own (variable, can wrap) height,
 * the main panel's border, the now-playing panel (border + variable content height),
 * and the play-all error line are all added on top of this separately. */
const FIXED_CHROME_ROWS = 3;
/** Top+bottom border rows a Panel always adds around its content. */
const PANEL_BORDER_ROWS = 2;

const NEEDS_COOKIE_HINTS: Hint[] = [
  { key: "enter", label: "submit" },
  { key: "ctrl+c", label: "quit" },
];
const SEARCH_HINTS: Hint[] = [
  { key: "enter", label: "search" },
  { key: "esc", label: "cancel" },
];
const BROWSE_HINTS: Hint[] = [
  { key: "j/k", label: "move" },
  { key: "enter", label: "select" },
  { key: "p", label: "play all" },
  { key: "/", label: "search" },
  { key: "h", label: "home" },
  { key: "bksp", label: "back" },
  { key: "space", label: "pause" },
  { key: "f/b", label: "seek" },
  { key: "n/N", label: "track" },
  { key: "s", label: "stop" },
  { key: "q", label: "quit" },
];

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
  const [playAllError, setPlayAllError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);

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
    if (input === "h") {
      if (!innertube) return;
      setHomeError(null);
      getHomeSections(innertube)
        .then((sections) => browse.openResults("Home", sections))
        .catch((e: unknown) => {
          setHomeError(e instanceof Error ? e.message : String(e));
        });
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
      setPlayAllError(null);
      fetchPlayAllQueue(innertube, entry)
        .then((tracks) => {
          if (tracks.length > 0) queue.playQueue(tracks, 0);
        })
        .catch((e: unknown) => {
          setPlayAllError(e instanceof Error ? e.message : String(e));
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
      return;
    }
    if (input === "n") {
      queue.playNext();
      return;
    }
    if (input === "N") {
      queue.playPrev();
    }
  });

  const termRows = process.stdout.rows ?? 24;
  const termCols = process.stdout.columns ?? 80;
  const panelWidth = termCols - 2; // outer app padding (1 each side)
  // Border (2 chars) + Panel's own paddingX (2 chars) on top of the panel width.
  const panelContentWidth = panelWidth - 4;
  // Split-pane: list on the left, DetailPane on the right with its own left border.
  const listWidth = Math.max(20, Math.floor(panelContentWidth * 0.6));
  const detailBoxWidth = Math.max(10, panelContentWidth - listWidth);
  const detailContentWidth = Math.max(5, detailBoxWidth - 2); // border(1) + paddingLeft(1)

  const topError = playAllError ?? homeError;
  const activeHints =
    authStatus === "needs-cookie" ? NEEDS_COOKIE_HINTS : uiMode === "search" ? SEARCH_HINTS : BROWSE_HINTS;
  const footerRows = footerLineCount(activeHints, termCols - 2);

  // The now-playing panel's own border rows plus its variable content height only
  // apply once signed in; the top error line only exists when set. Both are variable,
  // so both must be subtracted here to match what's actually rendered.
  const nowPlayingChrome =
    authStatus === "signed-in" ? PANEL_BORDER_ROWS + nowPlayingRows(playback) : 0;
  const errorChrome = topError ? 1 : 0;
  const maxRows = Math.max(
    1,
    termRows - FIXED_CHROME_ROWS - PANEL_BORDER_ROWS - nowPlayingChrome - errorChrome - footerRows,
  );

  const selectedEntry = entries[selected] ?? null;

  return (
    <Box flexDirection="column" height={termRows} width={termCols} padding={1} overflow="hidden">
      {topError && <Text color={theme.red}>{`Couldn't do that: ${topError}`}</Text>}

      <Panel title="cg-ytmusic" rightLabel={`v${version}`} width={panelWidth} grow>
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
            <Box flexDirection="row">
              <Box width={listWidth} flexDirection="column">
                <BrowseList
                  sections={browse.view.sections}
                  selectedIndex={selected}
                  maxRows={maxRows}
                  width={listWidth}
                  showSubtitle={false}
                />
              </Box>
              <Box
                borderStyle="single"
                borderTop={false}
                borderBottom={false}
                borderRight={false}
                borderColor={theme.dim}
                paddingLeft={1}
                width={detailBoxWidth}
                flexDirection="column"
              >
                <DetailPane entry={selectedEntry} width={detailContentWidth} />
              </Box>
            </Box>
          ) : null)}
      </Panel>

      {authStatus === "signed-in" && (
        <Panel title="Now Playing" width={panelWidth}>
          <NowPlaying playback={playback} queue={queue} />
        </Panel>
      )}

      <Box marginTop={1}>
        <Footer hints={activeHints} width={termCols - 2} />
      </Box>
    </Box>
  );
}
