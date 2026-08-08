import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export function Header({ brand, width }: { brand: string; width: number }): React.ReactElement {
  return (
    <Box width={width}>
      <Text color={theme.accent} bold>
        {brand.toUpperCase()}
      </Text>
    </Box>
  );
}
