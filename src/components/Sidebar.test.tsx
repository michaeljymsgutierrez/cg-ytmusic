import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Sidebar } from "./Sidebar.js";
import { ICON } from "../icons.js";

describe("Sidebar", () => {
  it("renders all four nav rows plus the Playlists divider, in order", () => {
    const frame = render(<Sidebar section="library" focused={false} width={20} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[3]).toBe(""); // marginTop(1) blank line before the divider
    expect(lines[4]).toBe("Playlists");
  });

  it("marks the active section's row with the chevron marker only when the sidebar is focused", () => {
    const focused = render(<Sidebar section="library" focused={true} width={20} />).lastFrame() ?? "";
    expect(focused.split("\n")[0]).toBe(`${ICON.chevronRight} ${ICON.headphones}  Library`);

    const unfocused = render(<Sidebar section="library" focused={false} width={20} />).lastFrame() ?? "";
    expect(unfocused.split("\n")[0]).toBe(`  ${ICON.headphones}  Library`);
  });

  it("never shows the chevron marker on an inactive row, even when focused", () => {
    const frame = render(<Sidebar section="library" focused={true} width={20} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines[1]).toBe(`  ${ICON.list}  Queue`); // Queue is not the active section
    expect(lines[2]).toBe(`  ${ICON.compass}  Explore`);
    expect(lines[5]).toBe(`  ${ICON.star}  Favorites`);
  });

  it("switches which row is marked active based on the section prop", () => {
    const frame = render(<Sidebar section="favorites" focused={true} width={20} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines[0]).toBe(`  ${ICON.headphones}  Library`);
    expect(lines[5]).toBe(`${ICON.chevronRight} ${ICON.star}  Favorites`);
  });
});
