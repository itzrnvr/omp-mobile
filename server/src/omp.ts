/*
 * PURPOSE: Manages OMP CLI process lifecycle and JSON event streaming.
 * Uses node:child_process to spawn OMP, collects all stdout, and returns
 * parsed events for the caller to forward via WebSocket.
 *
 * ARCHITECTURE:
 *   1. Spawn OMP with --mode=json -p, write message to stdin
 *   2. Collect all stdout as text (process runs to completion)
 *   3. Parse JSON lines into events array
 *   4. Return { events, kill, done } — caller sends events via WS after done
 *
 * NOTE: Events are returned as a batch (not streamed) to avoid Bun WebSocket
 * send-from-event-callback timing issues. The caller sends them synchronously
 * after the process exits, before the "complete" message.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { OmpEvent, OmpSessionEvent } from "./types.ts";

export interface OmpSpawnOptions {
  content: string;
  sessionId?: string | null;
  model?: string;
  thinking?: string;
  autoApprove?: boolean;
  cwd?: string;
}

function buildArgs(opts: OmpSpawnOptions): string[] {
  const args: string[] = ["--mode=json", "-p", "--no-extensions"];

  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }
  if (opts.autoApprove !== false) {
    args.push("--auto-approve");
  }
  if (opts.model) {
    args.push("--model", opts.model);
  }
  if (opts.thinking) {
    args.push("--thinking", opts.thinking);
  }
  if (opts.cwd) {
    args.push("--cwd", opts.cwd);
  }

  return args;
}

export interface OmpProcessHandle {
  kill: () => void;
  done: Promise<number | null>;
  events: OmpEvent[];
  sessionId: string | null;
}

function parseLine(
  line: string,
  onSessionId: (id: string) => void,
): OmpEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed) as OmpEvent;
    if (event.type === "session") {
      onSessionId((event as OmpSessionEvent).id);
    }
    return event;
  } catch {
    return { type: "custom", customType: "raw_output", content: trimmed } satisfies OmpEvent;
  }
}

export function spawnOmp(opts: OmpSpawnOptions): OmpProcessHandle {
  const args = buildArgs(opts);
  const cwd = opts.cwd || process.cwd();

  const child: ChildProcessWithoutNullStreams = spawn("omp", args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd,
    shell: false,
  });

  child.stdin.write(opts.content);
  child.stdin.end();

  let stdoutData = "";
  let stderrData = "";

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutData += chunk.toString("utf-8");
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderrData += chunk.toString("utf-8");
  });

  const handle: OmpProcessHandle = {
    kill: () => { try { child.kill(); } catch { /* exited */ } },
    done: new Promise<number | null>((resolve) => {
      child.on("close", (code) => {
        if (stderrData.trim()) {
          for (const line of stderrData.split("\n")) {
            if (line.trim()) console.error(`[omp:stderr] ${line}`);
          }
        }
        // Parse all stdout into events array
        const sessionId: { value: string | null } = { value: null };
        for (const line of stdoutData.split("\n")) {
          const event = parseLine(line, (id) => { sessionId.value = id; });
          if (event) handle.events.push(event);
        }
        handle.sessionId = sessionId.value;
        resolve(code);
      });
      child.on("error", (err) => {
        console.error(`[omp:error] ${err.message}`);
        resolve(null);
      });
    }),
    events: [],
    sessionId: null,
  };

  return handle;
}

export async function getOmpVersion(): Promise<string> {
  try {
    const proc = Bun.spawn(["omp", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const match = output.match(/omp\/([\d.]+)/);
    return match ? `omp/${match[1]}` : output.trim();
  } catch {
    return "unknown";
  }
}
