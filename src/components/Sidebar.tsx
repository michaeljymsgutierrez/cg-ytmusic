import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { ICON } from "../icons.js";

export type Section = "library" | "queue" | "explore" | "favorites";

export const SIDEBAR_SECTIONS: Section[] = ["library", "queue", "explore", "favorites"];

const NAV_LABEL: Record<Section, string> = {
  library: "Library",
  queue: "Queue",
  explore: "Explore",
  favorites: "Favorites",
};

// See src/icons.ts - Nerd Font glyphs, shared across every component so
// selection markers/kind icons stay visually identical.
const NAV_ICON: Record<Section, string> = {
  library: ICON.headphones,
  queue: ICON.list,
  explore: ICON.compass,
  favorites: ICON.star,
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
  const marker = active && focused ? `${ICON.chevronRight} ` : "  ";
  // 2-space gap after the icon, not 1 - some Nerd Font glyphs render with enough
  // right-side bearing in Chael's terminal font that a single space visually
  // reads as no gap at all (icon and label looked jammed together live).
  const text = `${marker}${icon}  ${label}`.padEnd(width);
  return (
    <Text
      backgroundColor={active ? theme.accent : undefined}
      color={active ? theme.bg : theme.fg}
      bold={active}
      wrap="truncate-end"
    >
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
        <Text color={theme.dim}>Playlists</Text>
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
