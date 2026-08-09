import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { SearchInput } from "./SearchInput.js";

describe("SearchInput", () => {
  it("shows the prompt, value, and cursor with no loading/error lines", () => {
    const frame = render(<SearchInput value="query" />).lastFrame() ?? "";
    expect(frame).toBe("search: query█");
  });

  it("shows just the prompt and cursor when the value is empty", () => {
    const frame = render(<SearchInput value="" />).lastFrame() ?? "";
    expect(frame).toBe("search: █");
  });

  it("shows a 'Searching...' line when loading", () => {
    const frame = render(<SearchInput value="query" loading />).lastFrame() ?? "";
    expect(frame).toBe("search: query█\n\nSearching...");
  });

  it("shows the error message when one is given", () => {
    const frame = render(<SearchInput value="query" error="network error" />).lastFrame() ?? "";
    expect(frame).toBe("search: query█\n\nnetwork error");
  });

  it("shows both loading and error lines together", () => {
    const frame = render(<SearchInput value="query" loading error="oops" />).lastFrame() ?? "";
    expect(frame).toBe("search: query█\n\nSearching...\n\noops");
  });
});
