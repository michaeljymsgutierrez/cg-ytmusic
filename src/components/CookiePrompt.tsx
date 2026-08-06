import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface CookiePromptProps {
  /** Current buffer contents (the App owns the state; this just renders it). */
  value: string;
  error?: string | null;
}

/**
 * A masked single-line field for pasting a YouTube `Cookie` header value - never prints
 * the raw cookie to the screen (it's a live session credential), just its length.
 */
export function CookiePrompt({ value, error }: CookiePromptProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text color={theme.fg}>Sign in with a YouTube session cookie:</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.dim}>
          1. In a browser, sign in at music.youtube.com
        </Text>
        <Text color={theme.dim}>
          2. Open DevTools -&gt; Network, reload, click any youtubei/v1 request
        </Text>
        <Text color={theme.dim}>3. Copy its Request Headers -&gt; Cookie value</Text>
        <Text color={theme.dim}>4. Paste it here and press enter</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.yellow} bold>
          cookie:{" "}
        </Text>
        <Text color={theme.fg}>{"*".repeat(Math.min(value.length, 60))}</Text>
        <Text color={theme.cyan}>█</Text>
        {value.length > 0 && (
          <Text color={theme.dim}>{`  (${value.length} chars)`}</Text>
        )}
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color={theme.red}>{error}</Text>
        </Box>
      )}
    </Box>
  );
}
