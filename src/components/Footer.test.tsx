import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Footer, footerLineCount, type Hint } from "./Footer.js";

const hints: Hint[] = [
  { key: "a", label: "one" }, // chip width = 1 + 3 + 7 = 11
  { key: "b", label: "two" }, // chip width = 1 + 3 + 7 = 11
];

describe("footerLineCount", () => {
  it("returns 1 for a non-positive width", () => {
    expect(footerLineCount(hints, 0)).toBe(1);
    expect(footerLineCount(hints, -5)).toBe(1);
  });

  it("packs hints onto one row when they all fit", () => {
    expect(footerLineCount(hints, 25)).toBe(1);
  });

  it("wraps to a new row once the next chip would overflow the width", () => {
    expect(footerLineCount(hints, 15)).toBe(2);
  });

  it("packs three hints across rows as they overflow one at a time", () => {
    const three: Hint[] = [...hints, { key: "c", label: "three" }]; // width 1+5+7=13
    // Row budget of 22: "a"(11) fits, +"b"(11)=22 fits exactly, +"c"(13)=35 overflows -> new row.
    expect(footerLineCount(three, 22)).toBe(2);
  });

  it("always reserves at least one row even for a single very wide hint", () => {
    expect(footerLineCount([{ key: "ctrl+shift+x", label: "a very long action label" }], 10)).toBe(1);
  });
});

describe("Footer", () => {
  it("renders each hint as a bracketed key plus its label on one row when they fit", () => {
    const frame = render(<Footer hints={hints} width={25} />).lastFrame() ?? "";
    expect(frame).toBe("[ a ] one  [ b ] two");
  });

  it("wraps onto a second line once hints no longer fit the given width", () => {
    const frame = render(<Footer hints={hints} width={15} />).lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines).toEqual(["[ a ] one", "[ b ] two"]);
  });
});
