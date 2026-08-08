import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export type Section = "library" | "queue" | "explore" | "favorites";

export const SIDEBAR_SECTIONS: Section[] = ["library", "queue", "explore", "favorites"];

const NAV_LABEL: Record<Section, string> = {
  library: "LIBRARY",
  queue: "QUEUE",
  explore: "EXPLORE",
  favorites: "FAVORITES",
};

const NAV_ICON: Record<Section, string> = {
  library: "♫",
  queue: "≡",
  explore: "◎",
  favorites: "♥",
};

function NavRow({
  label,
  icon,
  active,
  focused,
  width,
}: {
  label: string;
  icon: string;
  active: boolean;
  focused: boolean;
  width: number;
}): React.ReactElement {
  const marker = active && focused ? "❯ " : "  ";
  const text = `${marker}${icon} ${label}`.padEnd(width);
  return (
    <Text backgroundColor={active ? theme.accent : undefined} color={active ? theme.bg : theme.fg} bold={active}>
      {text}
    </Text>
  );
}

export function Sidebar({
  section,
  focused,
  width,
}: {
  section: Section;
  focused: boolean;
  width: number;
}): React.ReactElement {
  return (
    <Box flexDirection="column" width={width}>
      <NavRow
        label={NAV_LABEL.library}
        icon={NAV_ICON.library}
        active={section === "library"}
        focused={focused}
        width={width}
      />
      <NavRow
        label={NAV_LABEL.queue}
        icon={NAV_ICON.queue}
        active={section === "queue"}
        focused={focused}
        width={width}
      />
      <NavRow
        label={NAV_LABEL.explore}
        icon={NAV_ICON.explore}
        active={section === "explore"}
        focused={focused}
        width={width}
      />
      <Box marginTop={1}>
        <Text color={theme.dim}>PLAYLISTS</Text>
      </Box>
      <NavRow
        label={NAV_LABEL.favorites}
        icon={NAV_ICON.favorites}
        active={section === "favorites"}
        focused={focused}
        width={width}
      />
    </Box>
  );
}
