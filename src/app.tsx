import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { theme } from "./theme.js";
import { useAuth } from "./hooks/useAuth.js";
import { usePlayer } from "./hooks/usePlayer.js";
import { useBrowse } from "./hooks/useBrowse.js";
import { useQueue } from "./hooks/useQueue.js";
import { CookiePrompt } from "./components/CookiePrompt.js";
import { SearchInput } from "./components/SearchInput.js";
import { Panel } from "./components/Panel.js";
import { Header } from "./components/Header.js";
import { Sidebar, SIDEBAR_SECTIONS, type Section } from "./components/Sidebar.js";
import { MainContent, mainContentChrome } from "./components/MainContent.js";
import { PlayerPanel, type FlashedControl } from "./components/PlayerPanel.js";
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
 * the auth-flow Panel's border, and the top error line are all added on top of this
 * separately. */
const FIXED_CHROME_ROWS = 3;
/** Header's own rows: the stat/brand line plus its bottom divider border. */
const HEADER_CHROME_ROWS = 2;
/** Top+bottom border rows a Panel always adds around its content - the dashboard's
 * three columns (Sidebar/MainContent/PlayerPanel) are each wrapped in one. */
const PANEL_BORDER_ROWS = 2;
/** Border(1) + Panel's own paddingX(1) consumed on EACH side of a Panel's width. */
const PANEL_HORIZONTAL_CHROME = 4;
/** How long a Controls icon stays lime-highlighted after its hotkey is pressed. */
const CONTROL_FLASH_MS = 400;

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
  { key: "tab", label: "sidebar" },
  { key: "enter", label: "select" },
  { key: "p", label: "play all" },
  { key: "/", label: "search" },
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
    return playableEntries(tracks).map((e) => ({ id: e.id!, title: e.title, subtitle: e.subtitle }));
  }
  if (entry.kind === "artist") {
    const sections = await getArtistSections(innertube, entry.id);
    const withSongs = sections.find((s) => playableEntries(s.entries).length > 0);
    return withSongs
      ? playableEntries(withSongs.entries).map((e) => ({ id: e.id!, title: e.title, subtitle: e.subtitle }))
      : [];
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

  const [section, setSection] = useState<Section>("library");
  const [sidebarFocused, setSidebarFocused] = useState(false);

  const [uiMode, setUiMode] = useState<"browse" | "search">("browse");
  const [searchBuffer, setSearchBuffer] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playAllError, setPlayAllError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Drives PlayerPanel's Controls highlight: whichever icon's hotkey was actually
  // just pressed lights up lime, then fades - a real "you pressed this" instead of a
  // highlight permanently pinned to one button. `flashId` guards against a rapid
  // second press clearing itself early (the stale timeout from the first press would
  // otherwise null out the second press's still-active flash).
  const [controlFlash, setControlFlash] = useState<{ control: FlashedControl; id: number } | null>(null);
  const flashIdRef = useRef(0);
  function flashControl(control: FlashedControl): void {
    const id = ++flashIdRef.current;
    setControlFlash({ control, id });
    setTimeout(() => {
      setControlFlash((cur) => (cur?.id === id ? null : cur));
    }, CONTROL_FLASH_MS);
  }

  const entries = browse.view?.sections.flatMap((s) => s.entries) ?? [];
  const activeListLength = section === "queue" ? queue.tracks.length : entries.length;

  // Each sidebar section owns what the browse stack should show - Library resets to
  // root, Explore/Favorites fetch+push their content, Queue needs no browse data at
  // all (MainContent reads straight off useQueue). Runs on mount too (section starts
  // "library"), which is a harmless no-op goToRoot on an empty/root-only stack.
  useEffect(() => {
    if (authStatus !== "signed-in" || !innertube) return;
    setSectionError(null);
    if (section === "library") {
      browse.goToRoot();
    } else if (section === "explore") {
      getHomeSections(innertube)
        .then((sections) => browse.openResults("Home", sections))
        .catch((e: unknown) => setSectionError(e instanceof Error ? e.message : String(e)));
    } else if (section === "favorites") {
      const liked = browse.root?.sections.flatMap((s) => s.entries).find((e) => /liked/i.test(e.title));
      if (liked) {
        browse.goToRoot();
        browse.open(liked);
      } else {
        setSectionError("No favorites found.");
      }
    }
    // Only re-runs on a section/auth/innertube change, not every browse-stack mutation
    // this effect itself triggers - browse's methods are individually memoized so the
    // closure stays correct even though the `browse` object literal is new each render.
  }, [section, authStatus, innertube]);

  useEffect(() => {
    // Only reacts to a section switch, not to queue.currentIndex ticking while already
    // parked on the Queue section (that would fight manual selection).
    setSelected(section === "queue" ? Math.max(0, queue.currentIndex) : 0);
  }, [section]);

  useEffect(() => {
    setSelected((s) => (activeListLength === 0 ? 0 : Math.min(s, activeListLength - 1)));
  }, [activeListLength]);

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
    if (key.tab) {
      setSidebarFocused((f) => !f);
      return;
    }
    if (key.downArrow || input === "j") {
      if (sidebarFocused) {
        setSection((s) => SIDEBAR_SECTIONS[(SIDEBAR_SECTIONS.indexOf(s) + 1) % SIDEBAR_SECTIONS.length]);
      } else {
        setSelected((s) => Math.min(s + 1, Math.max(0, activeListLength - 1)));
      }
      return;
    }
    if (key.upArrow || input === "k") {
      if (sidebarFocused) {
        setSection(
          (s) => SIDEBAR_SECTIONS[(SIDEBAR_SECTIONS.indexOf(s) - 1 + SIDEBAR_SECTIONS.length) % SIDEBAR_SECTIONS.length],
        );
      } else {
        setSelected((s) => Math.max(s - 1, 0));
      }
      return;
    }
    if (input === "/") {
      setSearchBuffer("");
      setSearchError(null);
      setUiMode("search");
      return;
    }
    if (key.return) {
      if (sidebarFocused) {
        setSidebarFocused(false);
        return;
      }
      if (section === "queue") {
        if (queue.tracks.length > 0) queue.playQueue(queue.tracks, selected);
        return;
      }
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
    if (input === "p" && section !== "queue") {
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
    if (section !== "queue" && (key.backspace || key.delete || key.escape) && browse.canGoBack) {
      browse.goBack();
      return;
    }
    if (input === " ") {
      playback.togglePause();
      flashControl("playPause");
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
      flashControl("next");
      return;
    }
    if (input === "N") {
      queue.playPrev();
      flashControl("prev");
    }
  });

  const termRows = process.stdout.rows ?? 24;
  const termCols = process.stdout.columns ?? 80;
  const panelWidth = termCols - 2; // outer app padding (1 each side)

  // Signed-in dashboard columns: Sidebar (fixed) | MainContent (flex) | PlayerPanel
  // (fixed) - each wrapped in its own bordered Panel, so `width` here is the OUTER
  // panel width; every Panel consumes PANEL_HORIZONTAL_CHROME (border+paddingX on
  // both sides) before its child sees any content width.
  const sidebarWidth = Math.max(18, Math.floor(panelWidth * 0.2));
  const playerBoxWidth = Math.max(28, Math.floor(panelWidth * 0.32));
  const mainWidth = Math.max(24, panelWidth - sidebarWidth - playerBoxWidth);
  const sidebarContentWidth = Math.max(10, sidebarWidth - PANEL_HORIZONTAL_CHROME);
  const mainContentWidth = Math.max(10, mainWidth - PANEL_HORIZONTAL_CHROME);
  const playerContentWidth = Math.max(10, playerBoxWidth - PANEL_HORIZONTAL_CHROME);

  const topError = playAllError ?? sectionError;
  const activeHints =
    authStatus === "needs-cookie" ? NEEDS_COOKIE_HINTS : uiMode === "search" ? SEARCH_HINTS : BROWSE_HINTS;
  const footerRows = footerLineCount(activeHints, termCols - 2);
  const errorChrome = topError ? 1 : 0;

  const dashboardRows = Math.max(
    1,
    termRows - FIXED_CHROME_ROWS - HEADER_CHROME_ROWS - errorChrome - footerRows,
  );
  const mainContentRows = Math.max(
    1,
    dashboardRows - PANEL_BORDER_ROWS - mainContentChrome(section, queue.tracks.length),
  );

  const mainPanelTitle =
    section === "queue" ? "QUEUE" : (browse.view?.title.toUpperCase() ?? "LIBRARY");

  return (
    <Box flexDirection="column" height={termRows} width={termCols} padding={1} overflow="hidden">
      {topError && <Text color={theme.red}>{`Couldn't do that: ${topError}`}</Text>}

      {authStatus !== "signed-in" ? (
        <Panel title="cg-ytmusic" rightLabel={`v${version}`} width={panelWidth} grow>
          {authStatus === "checking" && <Text color={theme.yellow}>Checking saved sign-in...</Text>}
          {authStatus === "needs-cookie" && <CookiePrompt value={cookieBuffer} error={authError} />}
          {authStatus === "verifying" && <Text color={theme.yellow}>Verifying...</Text>}
        </Panel>
      ) : uiMode === "search" ? (
        <Panel title="Search" rightLabel={`v${version}`} width={panelWidth} grow>
          <SearchInput value={searchBuffer} loading={searchLoading} error={searchError} />
        </Panel>
      ) : (
        <Box flexDirection="column" width={panelWidth} height={dashboardRows + HEADER_CHROME_ROWS}>
          <Box
            width={panelWidth}
            borderStyle="single"
            borderTop={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.border}
            paddingBottom={0}
          >
            <Header brand="cg-ytmusic" width={panelWidth} />
          </Box>
          <Box flexDirection="row" width={panelWidth}>
            <Panel title="MENU" width={sidebarWidth} height={dashboardRows}>
              <Sidebar section={section} focused={sidebarFocused} width={sidebarContentWidth} />
            </Panel>
            <Panel title={mainPanelTitle} width={mainWidth} height={dashboardRows}>
              <MainContent
                section={section}
                browseView={browse.view}
                browseLoading={browse.loading}
                browseError={browse.error}
                selected={selected}
                queue={queue}
                maxRows={mainContentRows}
                width={mainContentWidth}
              />
            </Panel>
            <Panel title="PLAYER" width={playerBoxWidth} height={dashboardRows}>
              <PlayerPanel
                playback={playback}
                queue={queue}
                width={playerContentWidth}
                height={dashboardRows - PANEL_BORDER_ROWS}
                flashedControl={controlFlash?.control ?? null}
              />
            </Panel>
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Footer hints={activeHints} width={termCols - 2} />
      </Box>
    </Box>
  );
}
