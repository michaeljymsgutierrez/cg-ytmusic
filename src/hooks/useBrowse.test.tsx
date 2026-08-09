import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Innertube } from "youtubei.js";
import { renderHook } from "./testHarness.js";
import type { BrowseEntry, BrowseSection } from "../library.js";

const { getArtistSections, getLibrarySections, getPlaylistTracks } = vi.hoisted(() => ({
  getArtistSections: vi.fn(),
  getLibrarySections: vi.fn(),
  getPlaylistTracks: vi.fn(),
}));
vi.mock("../library.js", () => ({ getArtistSections, getLibrarySections, getPlaylistTracks }));

const { useBrowse } = await import("./useBrowse.js");

const fakeInnertube = {} as Innertube;

const librarySections: BrowseSection[] = [
  { title: "Liked Music", entries: [{ kind: "song", title: "Song A", subtitle: "", id: "s1" }] },
];

beforeEach(() => {
  getArtistSections.mockReset();
  getLibrarySections.mockReset().mockResolvedValue(librarySections);
  getPlaylistTracks.mockReset();
});

describe("useBrowse", () => {
  it("stays empty and does not fetch when innertube is null", () => {
    const { result } = renderHook(() => useBrowse(null));
    expect(result.current.view).toBeNull();
    expect(result.current.root).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(getLibrarySections).not.toHaveBeenCalled();
  });

  it("fetches the library root on mount when innertube is provided", async () => {
    const { result } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());
    expect(getLibrarySections).toHaveBeenCalledWith(fakeInnertube);
    expect(result.current.view).toEqual({ title: "Library", sections: librarySections });
    expect(result.current.root).toEqual(result.current.view);
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("sets an error and stops loading when the library fetch fails", async () => {
    getLibrarySections.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.loading).toBe(false);
  });

  it("open() on a playlist entry fetches its tracks and pushes a new view", async () => {
    const playlistEntry: BrowseEntry = { kind: "playlist", title: "My Mix", subtitle: "", id: "PL1" };
    const tracks: BrowseEntry[] = [{ kind: "song", title: "Track 1", subtitle: "", id: "t1" }];
    getPlaylistTracks.mockResolvedValue(tracks);

    const { result } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());

    result.current.open(playlistEntry);
    await vi.waitFor(() => expect(result.current.canGoBack).toBe(true));
    expect(getPlaylistTracks).toHaveBeenCalledWith(fakeInnertube, "PL1");
    expect(result.current.view).toEqual({ title: "My Mix", sections: [{ title: "My Mix", entries: tracks }] });
    expect(result.current.root?.title).toBe("Library");
  });

  it("open() on an album entry also fetches via getPlaylistTracks (same code path as playlist)", async () => {
    const albumEntry: BrowseEntry = { kind: "album", title: "An Album", subtitle: "", id: "AL1" };
    getPlaylistTracks.mockResolvedValue([{ kind: "song", title: "Track", subtitle: "", id: "t1" }]);

    const { result } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());

    result.current.open(albumEntry);
    await vi.waitFor(() => expect(result.current.canGoBack).toBe(true));
    expect(getPlaylistTracks).toHaveBeenCalledWith(fakeInnertube, "AL1");
  });

  it("open() on an artist entry fetches artist sections instead", async () => {
    const artistEntry: BrowseEntry = { kind: "artist", title: "An Artist", subtitle: "", id: "UC1" };
    const sections: BrowseSection[] = [{ title: "Top songs", entries: [] }];
    getArtistSections.mockResolvedValue(sections);

    const { result } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());

    result.current.open(artistEntry);
    await vi.waitFor(() => expect(result.current.canGoBack).toBe(true));
    expect(getArtistSections).toHaveBeenCalledWith(fakeInnertube, "UC1");
    expect(result.current.view).toEqual({ title: "An Artist", sections });
  });

  it("open() is a no-op for a song/video entry (caller plays those directly)", async () => {
    const songEntry: BrowseEntry = { kind: "song", title: "A Song", subtitle: "", id: "s1" };
    const { result } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());

    result.current.open(songEntry);
    expect(getPlaylistTracks).not.toHaveBeenCalled();
    expect(getArtistSections).not.toHaveBeenCalled();
    expect(result.current.canGoBack).toBe(false);
  });

  it("openResults pushes an already-fetched view without any additional fetch", async () => {
    const { result, waitForNextUpdate } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());

    const searchSections: BrowseSection[] = [{ title: "Songs", entries: [] }];
    const next = waitForNextUpdate();
    result.current.openResults("Search: query", searchSections);
    await next;
    expect(result.current.view).toEqual({ title: "Search: query", sections: searchSections });
    expect(getLibrarySections).toHaveBeenCalledTimes(1);
  });

  it("goBack pops back to the previous view, goToRoot collapses the whole stack", async () => {
    const { result, waitForNextUpdate } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());

    let next = waitForNextUpdate();
    result.current.openResults("Level 2", [{ title: "L2", entries: [] }]);
    await next;
    next = waitForNextUpdate();
    result.current.openResults("Level 3", [{ title: "L3", entries: [] }]);
    await next;
    expect(result.current.view?.title).toBe("Level 3");

    next = waitForNextUpdate();
    result.current.goBack();
    await next;
    expect(result.current.view?.title).toBe("Level 2");
    expect(result.current.canGoBack).toBe(true);

    next = waitForNextUpdate();
    result.current.goToRoot();
    await next;
    expect(result.current.view?.title).toBe("Library");
    expect(result.current.canGoBack).toBe(false);
  });

  it("goBack at the root is a no-op", async () => {
    const { result } = renderHook(() => useBrowse(fakeInnertube));
    await vi.waitFor(() => expect(result.current.view).not.toBeNull());
    result.current.goBack();
    expect(result.current.view?.title).toBe("Library");
  });
});
