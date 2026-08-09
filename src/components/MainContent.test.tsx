import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { MainContent, mainContentChrome } from "./MainContent.js";
import type { BrowseView } from "../hooks/useBrowse.js";
import type { UseQueueResult } from "../hooks/useQueue.js";

function makeQueue(overrides: Partial<UseQueueResult> = {}): UseQueueResult {
  return { tracks: [], currentIndex: -1, playQueue: () => {}, playNext: () => {}, playPrev: () => {}, ...overrides };
}

const view: BrowseView = {
  title: "Library",
  sections: [{ title: "Liked", entries: [{ kind: "song", title: "Song 1", subtitle: "", id: "s1" }] }],
};

describe("mainContentChrome", () => {
  it("reserves no rows for the stacked queue outside the library section", () => {
    expect(mainContentChrome("queue", 5)).toBe(0);
    expect(mainContentChrome("explore", 5)).toBe(0);
    expect(mainContentChrome("favorites", 5)).toBe(0);
  });

  it("reserves no rows in the library section when the queue is empty", () => {
    expect(mainContentChrome("library", 0)).toBe(0);
  });

  it("reserves header + preview rows in the library section once the queue has tracks", () => {
    expect(mainContentChrome("library", 1)).toBe(5); // STACKED_QUEUE_HEADER_ROWS(2) + STACKED_QUEUE_ROWS(3)
  });
});

describe("MainContent", () => {
  it("shows a loading indicator while the browse view is still loading and nothing is loaded yet", () => {
    const frame =
      render(<MainContent section="library" browseView={null} browseLoading browseError={null} selected={0} queue={makeQueue()} maxRows={10} width={40} />).lastFrame() ??
      "";
    expect(frame).toBe("Loading...");
  });

  it("shows the browse error message when one is set", () => {
    const frame =
      render(<MainContent section="library" browseView={null} browseLoading={false} browseError="network down" selected={0} queue={makeQueue()} maxRows={10} width={40} />).lastFrame() ??
      "";
    expect(frame).toBe("Error: network down");
  });

  it("shows a placeholder when there is no view, no error, and nothing loading", () => {
    const frame =
      render(<MainContent section="library" browseView={null} browseLoading={false} browseError={null} selected={0} queue={makeQueue()} maxRows={10} width={40} />).lastFrame() ??
      "";
    expect(frame).toBe("Nothing here.");
  });

  it("delegates to QueuePreview when section is 'queue', regardless of browseView", () => {
    const q = makeQueue({ tracks: [{ id: "t1", title: "Queued Track" }], currentIndex: 0 });
    const frame =
      render(<MainContent section="queue" browseView={null} browseLoading={false} browseError={null} selected={0} queue={q} maxRows={10} width={40} />).lastFrame() ??
      "";
    expect(frame).toContain("Queued Track");
  });

  it("renders the BrowseList for a loaded library view", () => {
    const frame =
      render(<MainContent section="library" browseView={view} browseLoading={false} browseError={null} selected={0} queue={makeQueue()} maxRows={10} width={40} />).lastFrame() ??
      "";
    expect(frame).toContain("Liked");
    expect(frame).toContain("Song 1");
    expect(frame).not.toContain("QUEUE");
  });

  it("stacks a QUEUE preview beneath the library list once the queue has tracks", () => {
    const q = makeQueue({ tracks: [{ id: "t1", title: "Queued 1" }], currentIndex: 0 });
    const frame =
      render(<MainContent section="library" browseView={view} browseLoading={false} browseError={null} selected={0} queue={q} maxRows={10} width={40} />).lastFrame() ??
      "";
    const lines = frame.split("\n");
    expect(lines).toContain("QUEUE");
    expect(frame.indexOf("QUEUE")).toBeGreaterThan(frame.indexOf("Liked"));
    expect(frame).toContain("Queued 1");
  });

  it("does not stack a queue preview outside the library section, even with tracks queued", () => {
    const q = makeQueue({ tracks: [{ id: "t1", title: "Queued 1" }], currentIndex: 0 });
    const frame =
      render(<MainContent section="explore" browseView={view} browseLoading={false} browseError={null} selected={0} queue={q} maxRows={10} width={40} />).lastFrame() ??
      "";
    expect(frame).not.toContain("QUEUE");
  });
});
