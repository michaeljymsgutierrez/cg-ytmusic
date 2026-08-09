import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock("execa", () => ({ execa }));

const { MpvClient, spawnMpv } = await import("./mpv.js");

describe("spawnMpv", () => {
  beforeEach(() => execa.mockReset());

  it("spawns mpv headless/idle on the given IPC socket, with output silenced and reject:false", () => {
    execa.mockReturnValue({});
    spawnMpv("/tmp/socket.sock");
    expect(execa).toHaveBeenCalledWith(
      "mpv",
      ["--idle=yes", "--no-video", "--no-terminal", "--input-ipc-server=/tmp/socket.sock"],
      { stdio: "ignore", reject: false },
    );
  });

  it("appends any extraArgs after the standard flags", () => {
    execa.mockReturnValue({});
    spawnMpv("/tmp/socket.sock", ["--ao=null"]);
    expect(execa).toHaveBeenCalledWith(
      "mpv",
      ["--idle=yes", "--no-video", "--no-terminal", "--input-ipc-server=/tmp/socket.sock", "--ao=null"],
      { stdio: "ignore", reject: false },
    );
  });
});

/** A minimal fake mpv JSON-IPC server: parses newline-delimited command JSON and hands
 * each to `respond`, writing back whatever it returns (if not null) as the response
 * line - real mpv's protocol shape, without needing an actual mpv binary in CI. */
describe("MpvClient", () => {
  let dir: string;
  let socketPath: string;
  let server: Server;
  let serverSocket: Socket | null;
  let received: Record<string, unknown>[];
  let respond: (msg: Record<string, unknown>) => Record<string, unknown> | null;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cg-ytmusic-test-"));
    socketPath = join(dir, "mpv.sock");
    serverSocket = null;
    received = [];
    respond = (msg) => ({ request_id: msg.request_id, error: "success", data: null });

    server = createServer((socket) => {
      serverSocket = socket;
      socket.setEncoding("utf8");
      let buffer = "";
      socket.on("data", (chunk: string) => {
        buffer += chunk;
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as Record<string, unknown>;
          received.push(msg);
          const res = respond(msg);
          if (res) socket.write(JSON.stringify(res) + "\n");
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  });

  afterEach(async () => {
    serverSocket?.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });

  it("connects and automatically observes the pause property", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    expect(received).toEqual([{ command: ["observe_property", 1, "pause"], request_id: 1 }]);
    client.close();
  });

  it("rejects connect() once the timeout elapses against an unreachable socket", async () => {
    const client = new MpvClient();
    await expect(client.connect(join(dir, "no-such.sock"), 150)).rejects.toBeTruthy();
  });

  it("matches command responses by request_id and resolves with the response data", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    respond = (msg) => ({ request_id: msg.request_id, error: "success", data: 42 });
    await expect(client.command(["get_property", "time-pos"])).resolves.toBe(42);
    client.close();
  });

  it("rejects the command promise when mpv responds with a non-success error", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    respond = (msg) => ({ request_id: msg.request_id, error: "property unavailable" });
    await expect(client.command(["get_property", "time-pos"])).rejects.toThrow(
      "mpv command failed: property unavailable",
    );
    client.close();
  });

  it("rejects command() when called before connect()", async () => {
    const client = new MpvClient();
    await expect(client.command(["stop"])).rejects.toThrow("MpvClient is not connected");
  });

  it.each([
    ["loadFile", (c: InstanceType<typeof MpvClient>) => c.loadFile("https://example.com/a.m4a"), ["loadfile", "https://example.com/a.m4a", "replace"]],
    ["play", (c: InstanceType<typeof MpvClient>) => c.play(), ["set_property", "pause", false]],
    ["pause", (c: InstanceType<typeof MpvClient>) => c.pause(), ["set_property", "pause", true]],
    ["togglePause", (c: InstanceType<typeof MpvClient>) => c.togglePause(), ["cycle", "pause"]],
    ["stop", (c: InstanceType<typeof MpvClient>) => c.stop(), ["stop"]],
    ["seek forward", (c: InstanceType<typeof MpvClient>) => c.seek(10), ["seek", 10, "relative"]],
    ["seek backward", (c: InstanceType<typeof MpvClient>) => c.seek(-10), ["seek", -10, "relative"]],
    ["quit", (c: InstanceType<typeof MpvClient>) => c.quit(), ["quit"]],
  ] as const)("%s sends the expected mpv command", async (_label, action, expectedCommand) => {
    const client = new MpvClient();
    await client.connect(socketPath);
    received = [];
    await action(client);
    expect(received).toEqual([{ command: expectedCommand, request_id: 2 }]);
    client.close();
  });

  it("re-emits a property-change event for pause as prop:pause with its data", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    const onPropPause = vi.fn();
    client.on("prop:pause", onPropPause);

    serverSocket!.write(
      JSON.stringify({ event: "property-change", name: "pause", data: true }) + "\n",
    );
    await vi.waitFor(() => expect(onPropPause).toHaveBeenCalledWith(true));
    client.close();
  });

  it("emits raw mpv events by name, e.g. end-file", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    const onEndFile = vi.fn();
    client.on("end-file", onEndFile);

    serverSocket!.write(JSON.stringify({ event: "end-file", reason: "eof" }) + "\n");
    await vi.waitFor(() => expect(onEndFile).toHaveBeenCalledWith({ event: "end-file", reason: "eof" }));
    client.close();
  });

  it("also emits every event on the wildcard '*' channel", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    const onAny = vi.fn();
    client.on("*", onAny);

    serverSocket!.write(JSON.stringify({ event: "unpause" }) + "\n");
    await vi.waitFor(() => expect(onAny).toHaveBeenCalledWith({ event: "unpause" }));
    client.close();
  });

  it("silently ignores a malformed (non-JSON) line instead of throwing", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    const onAny = vi.fn();
    client.on("*", onAny);

    serverSocket!.write("not json at all\n");
    serverSocket!.write(JSON.stringify({ event: "unpause" }) + "\n");
    await vi.waitFor(() => expect(onAny).toHaveBeenCalledTimes(1));
    client.close();
  });

  it("handles multiple JSON messages arriving in a single data chunk", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    const onAny = vi.fn();
    client.on("*", onAny);

    serverSocket!.write(
      JSON.stringify({ event: "unpause" }) + "\n" + JSON.stringify({ event: "pause" }) + "\n",
    );
    await vi.waitFor(() => expect(onAny).toHaveBeenCalledTimes(2));
    client.close();
  });

  it("close() tears down the socket so further use requires reconnecting", async () => {
    const client = new MpvClient();
    await client.connect(socketPath);
    client.close();
    await expect(client.command(["stop"])).rejects.toThrow("MpvClient is not connected");
  });
});
