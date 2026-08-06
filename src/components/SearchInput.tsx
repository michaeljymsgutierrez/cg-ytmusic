import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface SearchInputProps {
  value: string;
  loading?: boolean;
  error?: string | null;
}

/** A single-line search query field - App owns the buffer, this only paints it (same
 * split as cg-fileman's InputPrompt / cg-gh's AssigneeInput). */
export function SearchInput({ value, loading, error }: SearchInputProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.yellow} bold>
          search:{" "}
        </Text>
        <Text color={theme.fg}>{value}</Text>
        <Text color={theme.cyan}>█</Text>
      </Box>
      {loading && (
        <Box marginTop={1}>
          <Text color={theme.yellow}>Searching...</Text>
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color={theme.red}>{error}</Text>
        </Box>
      )}
    </Box>
  );
}
