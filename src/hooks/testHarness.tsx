import React from "react";
import { render } from "ink-testing-library";

/**
 * Minimal renderHook-alike for plain React hooks, built on ink-testing-library (there's
 * no react-test-renderer / @testing-library/react-hooks in this project's deps). Renders
 * a null-output Ink component that just calls the hook and stashes its return value on
 * `result.current` - callers await `waitForNextUpdate()` after triggering a state change
 * (calling one of the hook's returned callbacks, or mutating a dependency the test holds
 * and calling `rerender()`) since Ink's reconciler flushes asynchronously rather than
 * synchronously like legacy react-test-renderer.
 */
export function renderHook<T>(hook: () => T): {
  result: { current: T };
  waitForNextUpdate: () => Promise<void>;
  rerender: () => void;
  unmount: () => void;
} {
  const result: { current: T } = { current: undefined as unknown as T };
  let notify: (() => void) | null = null;

  function Harness(): null {
    result.current = hook();
    notify?.();
    return null;
  }

  const { rerender: inkRerender, unmount } = render(<Harness />);

  return {
    result,
    waitForNextUpdate: () =>
      new Promise<void>((resolve) => {
        notify = resolve;
      }),
    rerender: () => inkRerender(<Harness />),
    unmount,
  };
}
