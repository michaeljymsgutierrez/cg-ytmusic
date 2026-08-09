import { describe, expect, it } from "vitest";
import type { Innertube } from "youtubei.js";
import {
  getArtistSections,
  getHomeSections,
  getLibrarySections,
  getPlaylistTracks,
  playableEntries,
  queueFromSelection,
  searchMusic,
  splitSubtitle,
  type BrowseEntry,
  type BrowseSection,
} from "./library.js";

// Minimal raw-node builder matching what normalizeEntry expects off a real
// youtubei.js response node - only the fields normalizeEntry actually reads.
function node(overrides: Record<string, unknown>): Record<string, unknown> {
  return { type: "MusicResponsiveListItem", ...overrides };
}

function song(title: string, id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return node({ item_type: "song", title, endpoint: { payload: { videoId: id } }, ...extra });
}

describe("splitSubtitle", () => {
  it("splits an artist + duration subtitle", () => {
    expect(splitSubtitle("Some Artist • 3:45")).toEqual({ artist: "Some Artist", duration: "3:45" });
  });

  it("keeps multi-artist subtitles joined with the bullet separator intact as the artist part", () => {
    expect(splitSubtitle("Artist A • Artist B • 4:00")).toEqual({
      artist: "Artist A • Artist B",
      duration: "4:00",
    });
  });

  it("treats the whole subtitle as artist when there's no trailing duration", () => {
    expect(splitSubtitle("Just An Artist")).toEqual({ artist: "Just An Artist", duration: null });
  });

  it("returns empty artist and null duration for undefined", () => {
    expect(splitSubtitle(undefined)).toEqual({ artist: "", duration: null });
  });

  it("returns empty artist and null duration for an empty string", () => {
    expect(splitSubtitle("")).toEqual({ artist: "", duration: null });
  });

  it("does not mistake a non-duration-shaped trailing part for a duration", () => {
    expect(splitSubtitle("Artist • Album")).toEqual({ artist: "Artist • Album", duration: null });
  });
});

describe("playableEntries", () => {
  const entries: BrowseEntry[] = [
    { kind: "song", title: "Song", subtitle: "", id: "s1" },
    { kind: "video", title: "Video", subtitle: "", id: "v1" },
    { kind: "playlist", title: "Playlist", subtitle: "", id: "p1" },
    { kind: "artist", title: "Artist", subtitle: "", id: "a1" },
    { kind: "album", title: "Album", subtitle: "", id: "al1" },
    { kind: "unknown", title: "???", subtitle: "" },
    // song/video without an id shouldn't count as playable either.
    { kind: "song", title: "No id song", subtitle: "" },
  ];

  it("keeps only song/video entries that also have an id", () => {
    expect(playableEntries(entries)).toEqual([
      { kind: "song", title: "Song", subtitle: "", id: "s1" },
      { kind: "video", title: "Video", subtitle: "", id: "v1" },
    ]);
  });

  it("returns an empty array when nothing is playable", () => {
    expect(playableEntries([{ kind: "playlist", title: "P", subtitle: "", id: "p1" }])).toEqual([]);
  });
});

describe("queueFromSelection", () => {
  const sections: BrowseSection[] = [
    {
      title: "Section A",
      entries: [
        { kind: "song", title: "A1", subtitle: "", id: "a1" },
        { kind: "video", title: "A2", subtitle: "", id: "a2" },
        { kind: "artist", title: "A3 (not playable)", subtitle: "", id: "a3" },
      ],
    },
    {
      title: "Section B",
      entries: [
        { kind: "song", title: "B1", subtitle: "", id: "b1" },
        { kind: "song", title: "B2", subtitle: "", id: "b2" },
      ],
    },
  ];

  it("builds a queue from the whole section containing the selected entry, starting at its position", () => {
    // globalIndex 1 -> Section A's A2 (index 1 within Section A)
    const result = queueFromSelection(sections, 1);
    expect(result).toEqual({
      tracks: [
        { id: "a1", title: "A1", subtitle: "" },
        { id: "a2", title: "A2", subtitle: "" },
      ],
      startIndex: 1,
    });
  });

  it("queues only playable entries within the section, excluding non-song/video ones", () => {
    // globalIndex 0 -> Section A's A1; A3 is not playable so isn't in the resulting queue.
    const result = queueFromSelection(sections, 0);
    expect(result?.tracks.map((t) => t.id)).toEqual(["a1", "a2"]);
    expect(result?.startIndex).toBe(0);
  });

  it("resolves a global index into the correct later section", () => {
    // globalIndex 4 -> Section B's B2 (offset 3 + local index 1)
    const result = queueFromSelection(sections, 4);
    expect(result).toEqual({
      tracks: [
        { id: "b1", title: "B1", subtitle: "" },
        { id: "b2", title: "B2", subtitle: "" },
      ],
      startIndex: 1,
    });
  });

  it("returns null when the selected entry isn't playable (e.g. an artist row)", () => {
    // globalIndex 2 -> Section A's A3, kind "artist"
    expect(queueFromSelection(sections, 2)).toBeNull();
  });

  it("returns null when the index is out of range", () => {
    expect(queueFromSelection(sections, 99)).toBeNull();
  });
});

describe("normalizeEntry (via getLibrarySections)", () => {
  function innertubeWithLibrary(contents: unknown[]): Innertube {
    return { music: { getLibrary: async () => ({ contents }) } } as unknown as Innertube;
  }

  it("normalizes a MusicShelf section into a BrowseSection", async () => {
    const innertube = innertubeWithLibrary([
      {
        type: "MusicShelf",
        title: "Liked Music",
        contents: [song("Track One", "vid1")],
      },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections).toEqual([
      {
        title: "Liked Music",
        entries: [{ kind: "song", title: "Track One", subtitle: "", id: "vid1" }],
      },
    ]);
  });

  it("normalizes a Grid section (e.g. saved playlists/artists) using its header title", async () => {
    const innertube = innertubeWithLibrary([
      {
        type: "Grid",
        header: { title: "Playlists" },
        items: [
          node({
            type: "MusicTwoRowItem",
            item_type: "playlist",
            title: "My Playlist",
            endpoint: { payload: { browseId: "PL123" } },
          }),
        ],
      },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections).toEqual([
      {
        title: "Playlists",
        entries: [{ kind: "playlist", title: "My Playlist", subtitle: "", id: "PL123" }],
      },
    ]);
  });

  it("maps the library_artist item_type to the artist kind", async () => {
    const innertube = innertubeWithLibrary([
      {
        type: "MusicShelf",
        title: "Artists",
        contents: [node({ item_type: "library_artist", title: "Some Artist", id: "UC1" })],
      },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections[0].entries[0].kind).toBe("artist");
  });

  it("falls back to 'unknown' kind for an unrecognized item_type", async () => {
    const innertube = innertubeWithLibrary([
      { type: "MusicShelf", title: "Misc", contents: [node({ item_type: "something_new", title: "Mystery" })] },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections[0].entries[0].kind).toBe("unknown");
  });

  it("skips node types it doesn't recognize (buttons, continuations, ...)", async () => {
    const innertube = innertubeWithLibrary([
      {
        type: "MusicShelf",
        title: "Library",
        contents: [{ type: "ContinuationItem" }, song("Real Track", "vid1")],
      },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections[0].entries).toHaveLength(1);
    expect(sections[0].entries[0].title).toBe("Real Track");
  });

  it("omits a section entirely when it normalizes to zero entries", async () => {
    const innertube = innertubeWithLibrary([
      { type: "MusicShelf", title: "Empty", contents: [{ type: "ContinuationItem" }] },
      { type: "MusicShelf", title: "Not Empty", contents: [song("Track", "vid1")] },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Not Empty");
  });

  it("falls back to '(untitled)' when neither title nor name is present", async () => {
    const innertube = innertubeWithLibrary([
      { type: "MusicShelf", title: "Library", contents: [node({ item_type: "song", id: "vid1" })] },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections[0].entries[0].title).toBe("(untitled)");
  });

  it("joins multiple artists with a comma into the subtitle when no explicit subtitle is given", async () => {
    const innertube = innertubeWithLibrary([
      {
        type: "MusicShelf",
        title: "Library",
        contents: [
          node({
            item_type: "song",
            title: "Collab Track",
            artists: [{ name: "Artist A" }, { name: "Artist B" }],
            endpoint: { payload: { videoId: "vid1" } },
          }),
        ],
      },
    ]);
    const sections = await getLibrarySections(innertube);
    expect(sections[0].entries[0].subtitle).toBe("Artist A, Artist B");
  });

  it("appends duration to the subtitle only for song/video kinds", async () => {
    const innertube = innertubeWithLibrary([
      {
        type: "MusicShelf",
        title: "Library",
        contents: [
          node({
            item_type: "song",
            title: "Track",
            subtitle: "Artist Name",
            duration: { text: "3:30" },
            endpoint: { payload: { videoId: "vid1" } },
          }),
          node({
            item_type: "album",
            title: "Some Album",
            subtitle: "Artist Name",
            duration: { text: "3:30" },
            endpoint: { payload: { browseId: "AL1" } },
          }),
        ],
      },
    ]);
    const sections = await getLibrarySections(innertube);
    const [trackEntry, albumEntry] = sections[0].entries;
    expect(trackEntry.subtitle).toBe("Artist Name • 3:30");
    expect(albumEntry.subtitle).toBe("Artist Name");
  });
});

describe("getHomeSections", () => {
  it("normalizes MusicShelf and MusicCarouselShelf sections from the home feed", async () => {
    const innertube = {
      music: {
        getHomeFeed: async () => ({
          sections: [
            { type: "MusicShelf", title: "Quick picks", contents: [song("Pick", "p1")] },
            {
              type: "MusicCarouselShelf",
              header: { title: "Mixed for you" },
              contents: [song("Mix Track", "m1")],
            },
          ],
        }),
      },
    } as unknown as Innertube;
    const sections = await getHomeSections(innertube);
    expect(sections.map((s) => s.title)).toEqual(["Quick picks", "Mixed for you"]);
  });
});

describe("getPlaylistTracks", () => {
  it("normalizes a playlist's items", async () => {
    const innertube = {
      music: { getPlaylist: async () => ({ items: [song("Track 1", "t1"), song("Track 2", "t2")] }) },
    } as unknown as Innertube;
    const entries = await getPlaylistTracks(innertube, "PL1");
    expect(entries.map((e) => e.id)).toEqual(["t1", "t2"]);
  });
});

describe("getArtistSections", () => {
  it("normalizes MusicShelf and MusicCarouselShelf sections from an artist page", async () => {
    const innertube = {
      music: {
        getArtist: async () => ({
          sections: [
            { type: "MusicShelf", title: "Top songs", contents: [song("Hit", "h1")] },
            {
              type: "MusicCarouselShelf",
              header: { title: "Albums" },
              contents: [node({ item_type: "album", title: "Album 1", endpoint: { payload: { browseId: "AL1" } } })],
            },
          ],
        }),
      },
    } as unknown as Innertube;
    const sections = await getArtistSections(innertube, "UC1");
    expect(sections.map((s) => s.title)).toEqual(["Top songs", "Albums"]);
  });
});

describe("searchMusic", () => {
  it("buckets results by kind into Songs/Videos/Playlists/Albums/Artists, in that fixed order", async () => {
    const innertube = {
      music: {
        search: async () => ({
          contents: [
            {
              type: "ItemSection",
              contents: [
                node({ item_type: "artist", title: "An Artist", endpoint: { payload: { browseId: "UC1" } } }),
                song("A Song", "s1"),
                node({ item_type: "playlist", title: "A Playlist", endpoint: { payload: { browseId: "PL1" } } }),
              ],
            },
          ],
        }),
      },
    } as unknown as Innertube;
    const sections = await searchMusic(innertube, "query");
    expect(sections.map((s) => s.title)).toEqual(["Songs", "Playlists", "Artists"]);
  });

  it("drops entries whose kind has no bucket (unknown)", async () => {
    const innertube = {
      music: {
        search: async () => ({
          contents: [
            {
              type: "MusicShelf",
              contents: [node({ item_type: "something_weird", title: "???" }), song("Real Song", "s1")],
            },
          ],
        }),
      },
    } as unknown as Innertube;
    const sections = await searchMusic(innertube, "query");
    expect(sections).toEqual([{ title: "Songs", entries: [{ kind: "song", title: "Real Song", subtitle: "", id: "s1" }] }]);
  });

  it("ignores top-level sections that aren't ItemSection or MusicShelf", async () => {
    const innertube = {
      music: {
        search: async () => ({
          contents: [{ type: "DidYouMean", query: "something else" }, { type: "ItemSection", contents: [song("Song", "s1")] }],
        }),
      },
    } as unknown as Innertube;
    const sections = await searchMusic(innertube, "query");
    expect(sections).toEqual([{ title: "Songs", entries: [{ kind: "song", title: "Song", subtitle: "", id: "s1" }] }]);
  });
});
