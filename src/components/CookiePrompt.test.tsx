import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { CookiePrompt } from "./CookiePrompt.js";

const INSTRUCTIONS =
  "Sign in with a YouTube session cookie:\n\n" +
  "1. In a browser, sign in at music.youtube.com\n" +
  "2. Open DevTools -> Network, reload, click any youtubei/v1 request\n" +
  "3. Copy its Request Headers -> Cookie value\n" +
  "4. Paste it here and press enter\n\n";

describe("CookiePrompt", () => {
  it("masks the pasted cookie as asterisks and shows its character count", () => {
    const frame = render(<CookiePrompt value="abc" />).lastFrame() ?? "";
    expect(frame).toBe(`${INSTRUCTIONS}cookie: ***█  (3 chars)`);
  });

  it("shows no character count when the value is empty", () => {
    const frame = render(<CookiePrompt value="" />).lastFrame() ?? "";
    expect(frame).toBe(`${INSTRUCTIONS}cookie: █`);
  });

  it("caps the visible mask at 60 asterisks but still reports the real length beyond that", () => {
    const longValue = "x".repeat(90);
    const frame = render(<CookiePrompt value={longValue} />).lastFrame() ?? "";
    expect(frame).toBe(`${INSTRUCTIONS}cookie: ${"*".repeat(60)}█  (90 chars)`);
  });

  it("shows the error line only when an error is given", () => {
    const withoutError = render(<CookiePrompt value="abc" />).lastFrame() ?? "";
    expect(withoutError).not.toContain("invalid");

    const withError = render(<CookiePrompt value="abc" error="invalid cookie" />).lastFrame() ?? "";
    expect(withError).toBe(`${INSTRUCTIONS}cookie: ***█  (3 chars)\n\ninvalid cookie`);
  });
});
