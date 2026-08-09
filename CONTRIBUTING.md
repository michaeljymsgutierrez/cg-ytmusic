# Contributing to cg-ytmusic

Thanks for considering a contribution. This is a small terminal app maintained in spare
time, so keeping changes focused and well-tested goes a long way.

## Getting set up

Requires Node.js >= 18, [pnpm](https://pnpm.io), [mpv](https://mpv.io), and
[yt-dlp](https://github.com/yt-dlp/yt-dlp) on your `PATH` (see the README's
[Requirements](README.md#requirements) section for install commands per platform).

```bash
git clone https://github.com/michaeljymsgutierrez/cg-ytmusic.git
cd cg-ytmusic
pnpm install
pnpm dev
```

`pnpm dev` runs the app straight from source via `tsx` - no build step needed while
iterating.

## Before opening a PR

Run all three; a PR with any of these red won't be merged:

```bash
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
pnpm build        # confirms it also compiles clean to dist/
```

If you're changing UI (anything under `src/components/` or `src/app.tsx`), also run
`pnpm dev` and confirm it looks right in a real terminal - the test suite covers
rendering logic, not visual correctness.

## Project layout

```
src/
  app.tsx          # root component: layout, hotkeys, wiring the hooks together
  cli.tsx           # entrypoint: preflight checks, mpv process lifecycle, alt-screen
  auth.ts           # cookie-based sign-in
  library.ts        # normalizes youtubei.js responses into BrowseEntry/BrowseSection
  mpv.ts             # spawns mpv, JSON-IPC client
  ytdlp.ts           # resolves a video id to a playable stream URL
  theme.ts           # the single active color theme
  icons.ts           # shared Nerd Font glyphs
  window.ts          # scrollable-list windowing math
  hooks/              # useAuth, useBrowse, usePlayer, useQueue
  components/          # Ink components (Panel, Sidebar, BrowseList, PlayerPanel, ...)
```

Each hook and component generally has a matching `*.test.ts(x)` file next to it -
follow that pattern for new code rather than adding a separate `tests/` tree.

## Code style

- TypeScript strict mode is on; keep it that way rather than reaching for `any`.
- No comments explaining *what* code does - names should carry that. A comment is only
  worth adding for a non-obvious *why* (a workaround, a hidden constraint, something
  that would surprise a reader). Look at the existing source for the level of comment
  this project expects before adding more.
- Don't add abstractions, config options, or error handling for cases that can't
  happen here - this is a single-user local TUI, not a library.
- Match existing patterns rather than introducing a new one for the same problem -
  e.g. reuse `ICON`/`theme` instead of inline glyphs or colors, reuse `windowFor` for
  any new scrollable list.

## Commit messages

This repo follows [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description
```

`type` is one of `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `perf`,
`build`. `scope` is usually the file or component the change is centered on (e.g.
`player-panel`, `use-queue`, `mpv`). Keep the header under 100 characters; put anything
else in the body.

## Branches

```
type/short-description
```

Same `type` vocabulary as commits (`feat/`, `fix/`, `refactor/`, `test/`, `docs/`,
`chore/`).

## Reporting bugs / requesting features

Open a [GitHub issue](https://github.com/michaeljymsgutierrez/cg-ytmusic/issues) with:

- what you expected vs. what happened
- your OS, and `mpv --version` / `yt-dlp --version`
- repro steps if you have them

## License

By contributing, you agree your contributions are licensed under this project's
[MIT License](LICENSE).
