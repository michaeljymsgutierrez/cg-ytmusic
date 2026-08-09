import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Header } from "./Header.js";

describe("Header", () => {
  it("renders the brand upper-cased", () => {
    const frame = render(<Header brand="cg-ytmusic" width={20} />).lastFrame() ?? "";
    expect(frame).toBe("CG-YTMUSIC");
  });

  it("upper-cases a mixed-case brand too", () => {
    const frame = render(<Header brand="My Cool App" width={20} />).lastFrame() ?? "";
    expect(frame).toBe("MY COOL APP");
  });
});
