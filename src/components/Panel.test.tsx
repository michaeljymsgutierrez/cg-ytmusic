import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import stringWidth from "string-width";
import { Panel, buildTopLine } from "./Panel.js";
import { Box, Text } from "ink";

describe("buildTopLine", () => {
  it("embeds the title and right label and comes out to exactly `width` cells", () => {
    const line = buildTopLine("Library", "v0.1.0", 60);
    expect(stringWidth(line)).toBe(60);
    expect(line.startsWith("┌─ Library ")).toBe(true);
    expect(line.endsWith(" v0.1.0 ─┐")).toBe(true);
  });

  it("still fits exactly at `width` with no right label", () => {
    const line = buildTopLine("Search", undefined, 40);
    expect(stringWidth(line)).toBe(40);
    expect(line.endsWith("─┐")).toBe(true);
  });

  it("truncates a title too long for the available width instead of overflowing", () => {
    const line = buildTopLine("A very very very long panel title indeed", "v0.1.0", 30);
    expect(stringWidth(line)).toBe(30);
  });
});

describe("Panel", () => {
  it("renders a frame where every line is exactly `width` cells wide, with matching corners", () => {
    const width = 50;
    const frame =
      render(
        <Panel title="Library" rightLabel="v0.1.0" width={width}>
          <Text>row one</Text>
          <Text>row two</Text>
        </Panel>,
      ).lastFrame() ?? "";
    const lines = frame.split("\n");
    for (const line of lines) {
      expect(stringWidth(line)).toBe(width);
    }
    expect(lines[0]?.startsWith("┌")).toBe(true);
    expect(lines[0]?.endsWith("┐")).toBe(true);
    const lastLine = lines[lines.length - 1] ?? "";
    expect(lastLine.startsWith("└")).toBe(true);
    expect(lastLine.endsWith("┘")).toBe(true);
    for (const line of lines.slice(1, -1)) {
      expect(line.startsWith("│")).toBe(true);
      expect(line.endsWith("│")).toBe(true);
    }
  });

  it("with grow, fills a fixed-height parent instead of hugging its 1-line content, and a fixed sibling below stays its own natural height", () => {
    const width = 30;
    const frame =
      render(
        <Box flexDirection="column" height={12}>
          <Panel title="Library" width={width} grow>
            <Text>one row</Text>
          </Panel>
          <Panel title="Now Playing" width={width}>
            <Text>fixed row</Text>
          </Panel>
        </Box>,
      ).lastFrame() ?? "";
    const lines = frame.split("\n");
    // The growing panel must extend well past its own 1-line content - if grow did
    // nothing, its border would close after ~3 lines and the fixed panel would start
    // immediately after; here it should be pushed down toward the bottom instead.
    const nowPlayingLineIndex = lines.findIndex((l) => l.includes("Now Playing"));
    expect(nowPlayingLineIndex).toBeGreaterThan(5);
    // The fixed panel keeps its own natural (short) height regardless of how much
    // space the grown panel above it consumed.
    expect(lines.length - nowPlayingLineIndex).toBe(3);
  });
});
