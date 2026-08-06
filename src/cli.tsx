#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import { createRequire } from "node:module";
import { execa } from "execa";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "./app.js";
import { MpvClient, spawnMpv } from "./mpv.js";

const pkg = createRequire(import.meta.url)("../package.json") as { version: string };
const VERSION = pkg.version;

function printHelp(): void {
  console.log(`cg-ytmusic ${VERSION} - a terminal music player for YouTube Music

Usage:
  cg-ytmusic

Options:
  -v, --version   Print the version and exit
  -h, --help      Show this help

Signs in with a pasted YouTube session cookie on first run so your real library,
playlists, and likes are available. Requires mpv and yt-dlp on your PATH.`);
}

/** Fail fast with a friendly message if mpv or yt-dlp isn't installed. */
async function preflight(): Promise<void> {
  try {
    await execa("mpv", ["--version"]);
  } catch {
    console.error(
      "cg-ytmusic: 'mpv' was not found on your PATH.\n" +
        "Install it (e.g. 'brew install mpv') and try again.",
    );
    process.exit(1);
  }

  try {
    await execa("yt-dlp", ["--version"]);
  } catch {
    console.error(
      "cg-ytmusic: 'yt-dlp' was not found on your PATH.\n" +
        "Install it (e.g. 'brew install yt-dlp') and try again.",
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`cg-ytmusic ${VERSION}`);
    process.exit(0);
  }

  await preflight();

  const socketPath = join(tmpdir(), `cg-ytmusic-mpv-${process.pid}.sock`);
  const mpvProcess = spawnMpv(socketPath);
  const player = new MpvClient();
  await player.connect(socketPath);

  // Run in the alternate screen buffer (like less/vim/lazygit): the TUI owns a fixed
  // viewport, so there is no scrollback and no scroll-drift, and the user's shell
  // history is restored untouched on exit.
  const enterAltScreen = "\x1b[?1049h\x1b[H";
  const leaveAltScreen = "\x1b[?1049l";
  process.stdout.write(enterAltScreen);

  const { waitUntilExit } = render(<App version={VERSION} player={player} />);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    process.stdout.write(leaveAltScreen);
    player.close();
    mpvProcess.kill();
  };
  process.on("exit", restore);
  // Node only runs the "exit" handler above for a clean shutdown - a signal like
  // SIGTERM (e.g. from `timeout`, or a shell killing the process group) can terminate
  // the process without it, which is exactly how mpv got orphaned during testing here.
  // Handling the signals explicitly makes cleanup deterministic either way.
  const onSignal = () => {
    restore();
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    await waitUntilExit();
  } finally {
    restore();
  }
}

main().catch((err) => {
  console.error("cg-ytmusic: unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
