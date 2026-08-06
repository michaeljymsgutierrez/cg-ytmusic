import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Innertube, UniversalCache } from "youtubei.js";

const CONFIG_DIR = join(homedir(), ".config", "cg-ytmusic");
const COOKIE_PATH = join(CONFIG_DIR, "cookie.txt");

// OAuth device-code sign-in was tried first but dropped: youtubei.js OAuth sessions get
// HTTP 400 "Request contains an invalid argument" on nearly every browse-family call
// (getLibrary, getHistory, getChannel, ...) - a known, still-open upstream bug
// (github.com/LuanRT/YouTube.js#916). Cookie auth is what the library's own maintainer
// and multiple issue reporters confirm currently works for real account/library access.

export async function loadCachedCookie(): Promise<string | null> {
  try {
    const raw = await readFile(COOKIE_PATH, "utf8");
    return raw.trim() || null;
  } catch {
    return null;
  }
}

async function saveCookie(cookie: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(COOKIE_PATH, cookie, "utf8");
}

export async function clearCachedCookie(): Promise<void> {
  await rm(COOKIE_PATH, { force: true });
}

export interface SignInResult {
  innertube: Innertube;
  /** Number of library sections returned by the verifying call - proof the cookie
   * actually reached the signed-in account's own library, not just public data. */
  librarySectionCount: number;
}

/**
 * Creates a signed-in Innertube instance from a raw YouTube `Cookie` header string
 * (copied from a signed-in browser session) and verifies it against a real
 * account-scoped call. Saves the cookie for reuse on success; throws on failure
 * (invalid/expired cookie) without caching it.
 */
export async function signInWithCookie(cookie: string): Promise<SignInResult> {
  const innertube = await Innertube.create({
    cache: new UniversalCache(false),
    cookie,
  });
  // Fails fast if the cookie is invalid/expired rather than deferring to whatever the
  // first real UI call happens to be.
  const library = await innertube.music.getLibrary();
  await saveCookie(cookie);
  return { innertube, librarySectionCount: library.contents?.length ?? 0 };
}
