import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Header } from "./Header.js";

describe("Header", () => {
  it("renders the brand upper-cased with the version right-aligned", () => {
    const frame = render(<Header brand="cg-ytmusic" version="0.1.0" width={20} />).lastFrame() ?? "";
    expect(frame).toBe("CG-YTMUSIC    v0.1.0");
  });

  it("upper-cases a mixed-case brand too", () => {
    const frame = render(<Header brand="My Cool App" version="0.1.0" width={20} />).lastFrame() ?? "";
    expect(frame).toBe("MY COOL APP   v0.1.0");
  });

  it("prefixes the version with a lowercase v", () => {
    const frame = render(<Header brand="cg-ytmusic" version="1.2.3" width={20} />).lastFrame() ?? "";
    expect(frame).toContain("v1.2.3");
  });
});
