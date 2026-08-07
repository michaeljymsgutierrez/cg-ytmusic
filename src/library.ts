import type { Innertube } from "youtubei.js";

export type EntryKind = "song" | "video" | "playlist" | "artist" | "album" | "unknown";

export interface BrowseEntry {
  kind: EntryKind;
  title: string;
  subtitle: string;
  /** videoId for song/video, browseId for playlist/artist/album. */
  id?: string;
}

export interface BrowseSection {
  title: string;
  entries: BrowseEntry[];
}

const KNOWN_KINDS = new Set<EntryKind>(["song", "video", "playlist", "artist", "album"]);

function kindOf(itemType: string | undefined): EntryKind {
  if (itemType === "library_artist") return "artist";
  if (itemType && KNOWN_KINDS.has(itemType as EntryKind)) return itemType as EntryKind;
  return "unknown";
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof (value as { toString?: () => string }).toString === "function") {
    const s = (value as { toString: () => string }).toString();
    return s === "[object Object]" ? "" : s;
  }
  return "";
}

/** MusicResponsiveListItem and MusicTwoRowItem cover nearly everything in library/
 * playlist/artist responses; other node types (buttons, continuations, ...) are
 * skipped rather than guessed at. */
function normalizeEntry(node: { type?: string } & Record<string, unknown>): BrowseEntry | null {
  if (node.type !== "MusicResponsiveListItem" && node.type !== "MusicTwoRowItem") return null;

  const itemType = typeof node.item_type === "string" ? node.item_type : undefined;
  const kind = kindOf(itemType);
  const title = textOf(node.title) || textOf(node.name) || "(untitled)";
  const artists = Array.isArray(node.artists)
    ? (node.artists as { name: string }[]).map((a) => a.name).join(", ")
    : "";
  let subtitle = textOf(node.subtitle) || artists;
  const duration = node.duration as { text?: string } | undefined;
  if (duration?.text && (kind === "song" || kind === "video")) {
    subtitle = subtitle ? `${subtitle} • ${duration.text}` : duration.text;
  }
  const endpoint = node.endpoint as { payload?: Record<string, unknown> } | undefined;
  const id =
    (typeof node.id === "string" ? node.id : undefined) ??
    (typeof endpoint?.payload?.videoId === "string" ? (endpoint.payload.videoId as string) : undefined) ??
    (typeof endpoint?.payload?.browseId === "string" ? (endpoint.payload.browseId as string) : undefined);

  return { kind, title, subtitle, id };
}

function normalizeEntries(nodes: readonly unknown[] | undefined): BrowseEntry[] {
  if (!nodes) return [];
  const entries: BrowseEntry[] = [];
  for (const node of nodes) {
    const entry = normalizeEntry(node as { type?: string } & Record<string, unknown>);
    if (entry) entries.push(entry);
  }
  return entries;
}

/** The signed-in account's own library: liked songs, saved playlists/albums/artists. */
export async function getLibrarySections(innertube: Innertube): Promise<BrowseSection[]> {
  const library = await innertube.music.getLibrary();
  const sections: BrowseSection[] = [];
  for (const section of library.contents ?? []) {
    if (section.type === "MusicShelf") {
      const shelf = section as unknown as { title?: unknown; contents?: unknown[] };
      const entries = normalizeEntries(shelf.contents);
      if (entries.length > 0) sections.push({ title: textOf(shelf.title) || "Library", entries });
    } else if (section.type === "Grid") {
      const grid = section as unknown as { header?: unknown; items?: unknown[] };
      const header = grid.header as { title?: unknown } | undefined;
      const entries = normalizeEntries(grid.items);
      if (entries.length > 0) sections.push({ title: textOf(header?.title) || "Library", entries });
    }
  }
  return sections;
}

/** Only the entries playable as audio tracks (songs/videos), in their original order -
 * used to build a play queue from a mixed section (e.g. a playlist's tracklist, or the
 * subset of a browse view that's actually queueable). */
export function playableEntries(entries: BrowseEntry[]): BrowseEntry[] {
  return entries.filter((e) => (e.kind === "song" || e.kind === "video") && e.id);
}

export interface QueueTrack {
  id: string;
  title: string;
}

/**
 * Given a browse view's sections and a global (flattened-across-all-sections) selected
 * index, builds a queue from every playable entry in that ONE section (so opening a
 * song mid-playlist queues it plus the rest of the playlist, in order) and the starting
 * position within that queue. Returns null if the selected entry isn't playable or the
 * index is out of range.
 */
export function queueFromSelection(
  sections: BrowseSection[],
  globalIndex: number,
): { tracks: QueueTrack[]; startIndex: number } | null {
  let offset = 0;
  for (const section of sections) {
    if (globalIndex >= offset + section.entries.length) {
      offset += section.entries.length;
      continue;
    }
    const localIndex = globalIndex - offset;
    const selected = section.entries[localIndex];
    if (selected.kind !== "song" && selected.kind !== "video") return null;
    const playable = playableEntries(section.entries);
    const startIndex = playableEntries(section.entries.slice(0, localIndex + 1)).length - 1;
    return { tracks: playable.map((e) => ({ id: e.id!, title: e.title })), startIndex };
  }
  return null;
}

/** The home feed: YT Music's own suggestions/mixes (recommended songs, playlists,
 * artists) - same MusicCarouselShelf/MusicShelf shape as getArtistSections. */
export async function getHomeSections(innertube: Innertube): Promise<BrowseSection[]> {
  const home = await innertube.music.getHomeFeed();
  const sections: BrowseSection[] = [];
  for (const section of home.sections ?? []) {
    if (section.type === "MusicShelf") {
      const shelf = section as unknown as { title?: unknown; contents?: unknown[] };
      const entries = normalizeEntries(shelf.contents);
      if (entries.length > 0) sections.push({ title: textOf(shelf.title) || "Home", entries });
    } else if (section.type === "MusicCarouselShelf") {
      const carousel = section as unknown as { header?: { title?: unknown }; contents?: unknown[] };
      const entries = normalizeEntries(carousel.contents);
      if (entries.length > 0) {
        sections.push({ title: textOf(carousel.header?.title) || "Home", entries });
      }
    }
  }
  return sections;
}

/** A playlist's tracklist (also covers albums - both are fetched via getPlaylist). */
export async function getPlaylistTracks(innertube: Innertube, playlistId: string): Promise<BrowseEntry[]> {
  const playlist = await innertube.music.getPlaylist(playlistId);
  return normalizeEntries(playlist.items as unknown[] | undefined);
}

const SEARCH_BUCKET_TITLES: Record<EntryKind, string | null> = {
  song: "Songs",
  video: "Videos",
  playlist: "Playlists",
  album: "Albums",
  artist: "Artists",
  unknown: null,
};
const SEARCH_BUCKET_ORDER = ["Songs", "Videos", "Playlists", "Albums", "Artists"];

/**
 * Search results, split into Songs/Videos/Playlists/Albums/Artists sections. An
 * unfiltered search comes back as a flat list of `ItemSection`s with no useful header
 * (confirmed against a live search - not the `MusicShelf`-per-category shape the
 * `.songs`/`.videos`/etc. convenience getters expect, so those return undefined here);
 * bucketing by each entry's own `item_type` instead is what actually works.
 */
export async function searchMusic(innertube: Innertube, query: string): Promise<BrowseSection[]> {
  const results = await innertube.music.search(query);
  const buckets = new Map<string, BrowseEntry[]>();
  for (const section of results.contents ?? []) {
    if (section.type !== "ItemSection" && section.type !== "MusicShelf") continue;
    const contents = (section as unknown as { contents?: unknown[] }).contents;
    for (const entry of normalizeEntries(contents)) {
      const bucketTitle = SEARCH_BUCKET_TITLES[entry.kind];
      if (!bucketTitle) continue;
      const bucket = buckets.get(bucketTitle) ?? [];
      bucket.push(entry);
      buckets.set(bucketTitle, bucket);
    }
  }
  const sections: BrowseSection[] = [];
  for (const title of SEARCH_BUCKET_ORDER) {
    const entries = buckets.get(title);
    if (entries && entries.length > 0) sections.push({ title, entries });
  }
  return sections;
}

/** An artist's page: top songs, albums, etc. as separate sections. */
export async function getArtistSections(innertube: Innertube, artistId: string): Promise<BrowseSection[]> {
  const artist = await innertube.music.getArtist(artistId);
  const sections: BrowseSection[] = [];
  for (const section of artist.sections ?? []) {
    if (section.type === "MusicShelf") {
      const shelf = section as unknown as { title?: unknown; contents?: unknown[] };
      const entries = normalizeEntries(shelf.contents);
      if (entries.length > 0) sections.push({ title: textOf(shelf.title) || "Artist", entries });
    } else if (section.type === "MusicCarouselShelf") {
      const carousel = section as unknown as { header?: { title?: unknown }; contents?: unknown[] };
      const entries = normalizeEntries(carousel.contents);
      if (entries.length > 0) {
        sections.push({ title: textOf(carousel.header?.title) || "Artist", entries });
      }
    }
  }
  return sections;
}
