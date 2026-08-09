import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

const { mkdir, readFile, rm, writeFile } = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ mkdir, readFile, rm, writeFile }));

const { innertubeCreate, getLibrary } = vi.hoisted(() => ({
  innertubeCreate: vi.fn(),
  getLibrary: vi.fn(),
}));
vi.mock("youtubei.js", () => ({
  Innertube: { create: innertubeCreate },
  UniversalCache: vi.fn().mockImplementation((useTmp: boolean) => ({ useTmp })),
}));

const COOKIE_PATH = join(homedir(), ".config", "cg-ytmusic", "cookie.txt");

// Imported after the mocks are registered above (vi.mock calls are hoisted, but the
// import itself must still come after so the mocked modules are what auth.ts resolves).
const { clearCachedCookie, loadCachedCookie, signInWithCookie } = await import("./auth.js");

beforeEach(() => {
  mkdir.mockReset().mockResolvedValue(undefined);
  readFile.mockReset();
  rm.mockReset().mockResolvedValue(undefined);
  writeFile.mockReset().mockResolvedValue(undefined);
  innertubeCreate.mockReset();
  getLibrary.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("loadCachedCookie", () => {
  it("returns the trimmed cached cookie when the file exists", async () => {
    readFile.mockResolvedValue("  my-cookie-value  \n");
    await expect(loadCachedCookie()).resolves.toBe("my-cookie-value");
    expect(readFile).toHaveBeenCalledWith(COOKIE_PATH, "utf8");
  });

  it("returns null when the cached file is empty/whitespace-only", async () => {
    readFile.mockResolvedValue("   \n");
    await expect(loadCachedCookie()).resolves.toBeNull();
  });

  it("returns null when the file doesn't exist (read throws)", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    await expect(loadCachedCookie()).resolves.toBeNull();
  });
});

describe("clearCachedCookie", () => {
  it("force-removes the cookie file", async () => {
    await clearCachedCookie();
    expect(rm).toHaveBeenCalledWith(COOKIE_PATH, { force: true });
  });
});

describe("signInWithCookie", () => {
  it("creates a signed-in Innertube instance, verifies via getLibrary, and caches the cookie on success", async () => {
    const fakeInnertube = { music: { getLibrary } };
    innertubeCreate.mockResolvedValue(fakeInnertube);
    getLibrary.mockResolvedValue({ contents: [{ id: 1 }, { id: 2 }] });

    const result = await signInWithCookie("my-cookie");

    expect(innertubeCreate).toHaveBeenCalledWith(expect.objectContaining({ cookie: "my-cookie" }));
    expect(result.innertube).toBe(fakeInnertube);
    expect(result.librarySectionCount).toBe(2);
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(COOKIE_PATH, "my-cookie", "utf8");
  });

  it("reports zero library sections when contents is missing", async () => {
    innertubeCreate.mockResolvedValue({ music: { getLibrary } });
    getLibrary.mockResolvedValue({});

    const result = await signInWithCookie("my-cookie");
    expect(result.librarySectionCount).toBe(0);
  });

  it("propagates the error and does NOT cache the cookie when verification fails", async () => {
    innertubeCreate.mockResolvedValue({ music: { getLibrary } });
    getLibrary.mockRejectedValue(new Error("invalid cookie"));

    await expect(signInWithCookie("bad-cookie")).rejects.toThrow("invalid cookie");
    expect(writeFile).not.toHaveBeenCalled();
  });
});
