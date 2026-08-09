import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { BrowseList } from "./BrowseList.js";
import { ICON } from "../icons.js";
import type { BrowseSection } from "../library.js";

describe("BrowseList", () => {
  it("shows a placeholder when every section is empty", () => {
    const frame = render(<BrowseList sections={[]} selectedIndex={0} maxRows={5} width={40} />).lastFrame() ?? "";
    expect(frame).toBe("Nothing here.");
  });

  it("renders a section header followed by its entries, with the selected row marked", () => {
    const sections: BrowseSection[] = [
      { title: "Section A", entries: [{ kind: "song", title: "Song 1", subtitle: "Artist • 3:00", id: "s1" }] },
    ];
    const frame = render(<BrowseList sections={sections} selectedIndex={0} maxRows={5} width={40} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines[0]).toBe("Section A");
    // width=40: titleWidth = max(10, 40 - MARKER_WIDTH(2) - GLYPH_WIDTH(3) - (1+SUBTITLE_WIDTH(28))) = max(10, 6) = 10.
    expect(lines[1]).toBe(`${ICON.chevronRight} ${ICON.music}  ${"Song 1".padEnd(10)} Artist • 3:00`);
  });

  it("shows an unselected row with a blank marker instead of the chevron", () => {
    const sections: BrowseSection[] = [
      { title: "Section A", entries: [{ kind: "song", title: "Song 1", subtitle: "", id: "s1" }] },
    ];
    const frame = render(<BrowseList sections={sections} selectedIndex={-1} maxRows={5} width={40} />).lastFrame() ?? "";
    expect(frame.split("\n")[1]).toBe(`  ${ICON.music}  ${"Song 1".padEnd(10)} `.trimEnd());
  });

  it("hides the subtitle column when showSubtitle is false", () => {
    const sections: BrowseSection[] = [
      { title: "Section A", entries: [{ kind: "song", title: "Song 1", subtitle: "Artist • 3:00", id: "s1" }] },
    ];
    const frame =
      render(<BrowseList sections={sections} selectedIndex={0} maxRows={5} width={40} showSubtitle={false} />).lastFrame() ?? "";
    expect(frame.split("\n")[1]).toBe(`${ICON.chevronRight} ${ICON.music}  Song 1`);
  });

  it("uses distinct glyphs per entry kind (playlist/artist/album vs song/video)", () => {
    const sections: BrowseSection[] = [
      {
        title: "Mixed",
        entries: [
          { kind: "playlist", title: "A Playlist", subtitle: "", id: "p1" },
          { kind: "artist", title: "An Artist", subtitle: "", id: "a1" },
          { kind: "video", title: "A Video", subtitle: "", id: "v1" },
        ],
      },
    ];
    const frame =
      render(<BrowseList sections={sections} selectedIndex={-1} maxRows={10} width={40} showSubtitle={false} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines[1]).toBe(`  ${ICON.list}  A Playlist`);
    expect(lines[2]).toBe(`  ${ICON.microphone}  An Artist`);
    expect(lines[3]).toBe(`  ${ICON.music}  A Video`);
  });

  it("maps a flattened selectedIndex to the correct entry across multiple sections", () => {
    const sections: BrowseSection[] = [
      { title: "Section A", entries: [{ kind: "song", title: "A1", subtitle: "", id: "a1" }] },
      { title: "Section B", entries: [{ kind: "song", title: "B1", subtitle: "", id: "b1" }] },
    ];
    // selectedIndex 1 (flattened across sections) -> B1 is selected, not A1.
    const frame =
      render(<BrowseList sections={sections} selectedIndex={1} maxRows={10} width={40} showSubtitle={false} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines[1]).toBe(`  ${ICON.music}  A1`); // Section A's entry, unselected
    expect(lines[3]).toBe(`${ICON.chevronRight} ${ICON.music}  B1`); // Section B's entry, selected
  });

  it("shows a position counter row once entries exceed the visible row budget", () => {
    const sections: BrowseSection[] = [
      {
        title: "Big Section",
        entries: Array.from({ length: 10 }, (_, i) => ({
          kind: "song" as const,
          title: `Song ${i + 1}`,
          subtitle: "",
          id: `s${i}`,
        })),
      },
    ];
    const frame = render(<BrowseList sections={sections} selectedIndex={2} maxRows={5} width={40} />).lastFrame() ?? "";
    expect(frame.split("\n").at(-1)).toBe("3/10");
  });

  it("omits the position counter when everything fits within maxRows", () => {
    const sections: BrowseSection[] = [
      { title: "Section A", entries: [{ kind: "song", title: "Song 1", subtitle: "", id: "s1" }] },
    ];
    const frame = render(<BrowseList sections={sections} selectedIndex={0} maxRows={10} width={40} />).lastFrame() ?? "";
    expect(frame).not.toContain("/");
  });

  it("truncates a title too long for the available width", () => {
    const sections: BrowseSection[] = [
      {
        title: "Section A",
        entries: [{ kind: "song", title: "A Very Very Very Long Song Title Indeed", subtitle: "", id: "s1" }],
      },
    ];
    const frame =
      render(<BrowseList sections={sections} selectedIndex={-1} maxRows={5} width={40} showSubtitle={false} />).lastFrame() ?? "";
    expect(frame.split("\n")[1]).toContain("…");
  });
});
