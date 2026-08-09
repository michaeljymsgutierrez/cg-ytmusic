import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "./testHarness.js";

const { loadCachedCookie, clearCachedCookie, signInWithCookie } = vi.hoisted(() => ({
  loadCachedCookie: vi.fn(),
  clearCachedCookie: vi.fn(),
  signInWithCookie: vi.fn(),
}));
vi.mock("../auth.js", () => ({ loadCachedCookie, clearCachedCookie, signInWithCookie }));

const { useAuth } = await import("./useAuth.js");

beforeEach(() => {
  loadCachedCookie.mockReset();
  clearCachedCookie.mockReset().mockResolvedValue(undefined);
  signInWithCookie.mockReset();
});

describe("useAuth", () => {
  it("starts in 'checking' status", () => {
    loadCachedCookie.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAuth());
    expect(result.current.status).toBe("checking");
  });

  it("drops to 'needs-cookie' when there is no cached cookie", async () => {
    loadCachedCookie.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth());
    await vi.waitFor(() => expect(result.current.status).toBe("needs-cookie"));
    expect(result.current.error).toBeNull();
    expect(signInWithCookie).not.toHaveBeenCalled();
  });

  it("verifies a cached cookie automatically and signs in on success", async () => {
    loadCachedCookie.mockResolvedValue("cached-cookie");
    const fakeInnertube = { fake: true };
    signInWithCookie.mockResolvedValue({ innertube: fakeInnertube, librarySectionCount: 3 });

    const { result } = renderHook(() => useAuth());
    await vi.waitFor(() => expect(result.current.status).toBe("signed-in"));
    expect(signInWithCookie).toHaveBeenCalledWith("cached-cookie");
    expect(result.current.innertube).toBe(fakeInnertube);
    expect(result.current.librarySectionCount).toBe(3);
  });

  it("clears the cookie and falls back to 'needs-cookie' when the cached cookie fails verification", async () => {
    loadCachedCookie.mockResolvedValue("stale-cookie");
    signInWithCookie.mockRejectedValue(new Error("cookie expired"));

    const { result } = renderHook(() => useAuth());
    await vi.waitFor(() => expect(result.current.status).toBe("needs-cookie"));
    expect(clearCachedCookie).toHaveBeenCalled();
    expect(result.current.error).toBe("cookie expired");
  });

  it("submitCookie transitions through 'verifying' to 'signed-in' on success", async () => {
    loadCachedCookie.mockResolvedValue(null);
    const fakeInnertube = { fake: true };
    signInWithCookie.mockResolvedValue({ innertube: fakeInnertube, librarySectionCount: 1 });

    const { result } = renderHook(() => useAuth());
    await vi.waitFor(() => expect(result.current.status).toBe("needs-cookie"));

    result.current.submitCookie("pasted-cookie");
    await vi.waitFor(() => expect(result.current.status).toBe("signed-in"));
    expect(signInWithCookie).toHaveBeenCalledWith("pasted-cookie");
    expect(result.current.innertube).toBe(fakeInnertube);
  });

  it("submitCookie reports an error and returns to 'needs-cookie' on failure", async () => {
    loadCachedCookie.mockResolvedValue(null);
    signInWithCookie.mockRejectedValue(new Error("invalid cookie"));

    const { result } = renderHook(() => useAuth());
    await vi.waitFor(() => expect(result.current.status).toBe("needs-cookie"));

    result.current.submitCookie("bad-cookie");
    await vi.waitFor(() => expect(result.current.error).toBe("invalid cookie"));
    expect(result.current.status).toBe("needs-cookie");
    expect(clearCachedCookie).toHaveBeenCalled();
  });

  it("clears a previous error once a new submitCookie call starts verifying", async () => {
    loadCachedCookie.mockResolvedValue(null);
    signInWithCookie.mockRejectedValueOnce(new Error("first failure"));

    const { result } = renderHook(() => useAuth());
    await vi.waitFor(() => expect(result.current.status).toBe("needs-cookie"));
    result.current.submitCookie("bad-cookie");
    await vi.waitFor(() => expect(result.current.error).toBe("first failure"));

    signInWithCookie.mockReturnValueOnce(new Promise(() => {})); // never resolves - stay in "verifying"
    result.current.submitCookie("another-cookie");
    await vi.waitFor(() => expect(result.current.status).toBe("verifying"));
    expect(result.current.error).toBeNull();
  });
});
