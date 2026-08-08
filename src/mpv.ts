import { EventEmitter } from "node:events";
import { createConnection, type Socket } from "node:net";
import { execa, type ResultPromise } from "execa";

export interface MpvEndFileEvent {
  event: "end-file";
  reason: "eof" | "stop" | "quit" | "error" | "redirect" | (string & {});
}

/** Spawns a headless, idle mpv process listening on a JSON IPC socket. Caller owns the
 * returned process (kill it on app exit) and connects an `MpvClient` to `socketPath`.
 * `extraArgs` is for callers like automated verification (e.g. `--ao=null` for a silent
 * control-plane check) - production playback should leave it empty. */
export function spawnMpv(socketPath: string, extraArgs: string[] = []): ResultPromise {
  return execa(
    "mpv",
    ["--idle=yes", "--no-video", "--no-terminal", `--input-ipc-server=${socketPath}`, ...extraArgs],
    { stdio: "ignore", reject: false },
  );
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * A minimal client for mpv's JSON IPC protocol (https://mpv.io/manual/master/#json-ipc):
 * newline-delimited JSON commands in, newline-delimited JSON responses/events out.
 * Command responses are matched by `request_id`; anything with an `event` key instead
 * of `error` is an unsolicited event and is re-emitted on this client.
 */
export class MpvClient extends EventEmitter {
  #socket: Socket | null = null;
  #buffer = "";
  #nextRequestId = 1;
  #pending = new Map<number, PendingRequest>();

  async connect(socketPath: string, timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        this.#socket = await connectOnce(socketPath);
        break;
      } catch (err) {
        if (Date.now() > deadline) throw err;
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    this.#socket.setEncoding("utf8");
    this.#socket.on("data", (chunk: string) => this.#onData(chunk));
    // Modern mpv (confirmed on v0.41.0) no longer emits bare "pause"/"unpause" events -
    // only "property-change" for properties explicitly observed. Subscribe once here so
    // `prop:pause` is always available regardless of what callers remember to do.
    await this.command(["observe_property", 1, "pause"]);
  }

  #onData(chunk: string): void {
    this.#buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = this.#buffer.indexOf("\n")) !== -1) {
      const line = this.#buffer.slice(0, newlineIndex);
      this.#buffer = this.#buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;
      this.#handleLine(line);
    }
  }

  #handleLine(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    if (typeof msg.request_id === "number") {
      const pending = this.#pending.get(msg.request_id);
      if (!pending) return;
      this.#pending.delete(msg.request_id);
      if (msg.error === "success") pending.resolve(msg.data);
      else pending.reject(new Error(`mpv command failed: ${String(msg.error)}`));
      return;
    }
    if (typeof msg.event === "string") {
      this.emit(msg.event, msg);
      this.emit("*", msg);
      if (msg.event === "property-change" && typeof msg.name === "string") {
        this.emit(`prop:${msg.name}`, msg.data);
      }
    }
  }

  async command(args: unknown[]): Promise<unknown> {
    if (!this.#socket) throw new Error("MpvClient is not connected");
    const request_id = this.#nextRequestId++;
    const payload = JSON.stringify({ command: args, request_id }) + "\n";
    return new Promise((resolve, reject) => {
      this.#pending.set(request_id, { resolve, reject });
      this.#socket?.write(payload, (err) => {
        if (err) {
          this.#pending.delete(request_id);
          reject(err);
        }
      });
    });
  }

  loadFile(url: string): Promise<unknown> {
    return this.command(["loadfile", url, "replace"]);
  }

  play(): Promise<unknown> {
    return this.command(["set_property", "pause", false]);
  }

  pause(): Promise<unknown> {
    return this.command(["set_property", "pause", true]);
  }

  togglePause(): Promise<unknown> {
    return this.command(["cycle", "pause"]);
  }

  stop(): Promise<unknown> {
    return this.command(["stop"]);
  }

  /** Relative seek in seconds; negative seeks backward. */
  seek(deltaSeconds: number): Promise<unknown> {
    return this.command(["seek", deltaSeconds, "relative"]);
  }

  quit(): Promise<unknown> {
    return this.command(["quit"]);
  }

  close(): void {
    this.#socket?.destroy();
    this.#socket = null;
  }
}

function connectOnce(socketPath: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}
