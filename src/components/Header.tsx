import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export function Header({
  brand,
  version,
  width,
}: {
  brand: string;
  version: string;
  width: number;
}): React.ReactElement {
  return (
    <Box width={width} justifyContent="space-between">
      <Text color={theme.accent} bold>
        {brand.toUpperCase()}
      </Text>
      <Text color={theme.dim}>{`v${version}`}</Text>
    </Box>
  );
}
