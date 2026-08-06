import { useCallback, useEffect, useRef, useState } from "react";
import type { Innertube } from "youtubei.js";
import { clearCachedCookie, loadCachedCookie, signInWithCookie } from "../auth.js";

export type AuthStatus = "checking" | "needs-cookie" | "verifying" | "signed-in";

export interface UseAuthResult {
  status: AuthStatus;
  innertube: Innertube | null;
  librarySectionCount: number | null;
  /** Set when a submitted cookie failed verification; cleared on the next submit. */
  error: string | null;
  submitCookie: (cookie: string) => void;
}

/** On mount, tries a cached cookie; if missing or invalid, drops into "needs-cookie" so
 * the UI can collect one via `submitCookie`. */
export function useAuth(): UseAuthResult {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [innertube, setInnertube] = useState<Innertube | null>(null);
  const [librarySectionCount, setLibrarySectionCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const verify = useCallback((cookie: string) => {
    setStatus("verifying");
    setError(null);
    signInWithCookie(cookie)
      .then((result) => {
        setInnertube(result.innertube);
        setLibrarySectionCount(result.librarySectionCount);
        setStatus("signed-in");
      })
      .catch((e: unknown) => {
        void clearCachedCookie();
        setError(e instanceof Error ? e.message : String(e));
        setStatus("needs-cookie");
      });
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    loadCachedCookie().then((cached) => {
      if (cached) {
        verify(cached);
      } else {
        setStatus("needs-cookie");
      }
    });
  }, [verify]);

  return { status, innertube, librarySectionCount, error, submitCookie: verify };
}
