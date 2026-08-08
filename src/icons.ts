// Nerd Font (Font Awesome subset) glyphs from the Private Use Area, not standard
// Unicode dingbats - the whole point of Nerd Fonts is that every glyph renders at
// a consistent single-cell width/weight, sidestepping the per-character
// width/weight inconsistency this app kept hitting with plain Unicode symbols
// (hearts, stars, checkmarks, emoji, media-control glyphs). Built via
// String.fromCharCode on the numeric codepoint (not a literal character or a
// `\u` escape in source) - both of those were silently dropped by this session's
// text pipeline when writing this file, plain numeric codepoints are the only
// form confirmed to survive intact.
// Codepoints are from memory of the nerd-fonts Font Awesome cheat sheet, not
// independently re-verified here (no live TTY in this sandbox to confirm) -
// Chael confirmed his terminal already has a Nerd Font set; first live run
// should confirm these render as intended.
//
// One shared module (not per-component literals) so every selection marker and
// every kind/nav icon across Sidebar/BrowseList/PlayerPanel stays visually
// identical by construction, instead of drifting the way plain-Unicode choices
// did (Sidebar's "❯" vs BrowseList's "▶" were two different glyphs for the same
// "selected" concept before this).
const cp = (codePoint: number): string => String.fromCharCode(codePoint);

export const ICON = {
  music: cp(0xf001), // nf-fa-music - actual songs/tracks (BrowseList entries)
  // nf-fa-headphones - Sidebar's Library nav item. Was nf-fa-book (0xf02d), a
  // notebook that read as unrelated to a music app - Chael asked for something
  // actually music-relevant.
  headphones: cp(0xf025),
  list: cp(0xf03a), // nf-fa-list
  compass: cp(0xf14e), // nf-fa-compass
  star: cp(0xf005), // nf-fa-star
  // nf-fa-caret_right - the one selection marker, used everywhere. Was
  // nf-fa-chevron_right (0xf054), a thin angle-bracket outline shape - Chael
  // asked for a non-outlined arrow, caret_right is Font Awesome's solid/filled
  // counterpart to the chevron family.
  chevronRight: cp(0xf0da),
  // nf-fa-microphone - BrowseList's kind glyph for artist/album rows. Was
  // nf-fa-folder (0xf07b) - Chael flagged that as generic/unrelated to music
  // too, wanted something that actually reads as music-relevant.
  microphone: cp(0xf130),
  stepBackward: cp(0xf048), // nf-fa-step_backward
  stepForward: cp(0xf051), // nf-fa-step_forward
  play: cp(0xf04b), // nf-fa-play
  pause: cp(0xf04c), // nf-fa-pause
} as const;
