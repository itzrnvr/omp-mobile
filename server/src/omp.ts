/*
 * PURPOSE: Manages OMP CLI process lifecycle and JSON event streaming.
 * Uses node:child_process to spawn OMP and streams parsed JSON events to the
 * caller LIVE via onEvent as stdout lines arrive (line-buffered), so clients
 * see token deltas while the model is still generating.
 *
 * ARCHITECTURE:
 *   1. Spawn OMP with --mode=json -p, write message to stdin
 *   2. Line-buffer stdout; parse each complete line into an event
 *   3. Invoke onEvent(event) immediately AND append to handle.events
 *   4. Return { events, kill, done, sessionId } — done resolves on exit
 *
 * NOTE: handle.events still collects everything for callers that want the
 * full transcript after completion.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { OmpEvent, OmpSessionEvent } from "./types.ts";

export interface OmpSpawnOptions {
  content: string;
  sessionId?: string | null;
  model?: string;
  thinking?: string;
  autoApprove?: boolean;
  /** auto | ask | readonly — maps to omp approval flags. */
  approvalMode?: string;
  cwd?: string;
  /** Called immediately for each parsed event (live streaming). */
  onEvent?: (event: OmpEvent) => void;
}

function buildArgs(opts: OmpSpawnOptions): string[] {
  const args: string[] = ["--mode=json", "-p", "--no-extensions"];

  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }
  if (opts.autoApprove !== false) {
  if (
    opts.autoApprove !== false &&
    opts.approvalMode !== "ask" &&
    opts.approvalMode !== "readonly"
  ) {
    args.push("--auto-approve");
  }
  if (opts.approvalMode === "ask" || opts.approvalMode === "readonly") {
    // omp has no pure read-only flag for -p; always-ask denies interactive
    // approvals in non-interactive mode, which is the closest semantics.
    args.push("--approval-mode=always-ask");
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
  let stdoutBuf = "";
  let stderrData = "";
  const events: OmpEvent[] = [];
  const sessionIdRef: { value: string | null } = { value: null };

  const emitLine = (line: string) => {
    const event = parseLine(line, (id) => { sessionIdRef.value = id; });
    if (event) {
      events.push(event);
      if (opts.onEvent) opts.onEvent(event);
    }
  };

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString("utf-8");
    let idx = stdoutBuf.indexOf("\n");
    while (idx !== -1) {
      const line = stdoutBuf.slice(0, idx);
      stdoutBuf = stdoutBuf.slice(idx + 1);
      emitLine(line);
      idx = stdoutBuf.indexOf("\n");
    }
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
        // Flush any trailing partial line.
        if (stdoutBuf.trim()) emitLine(stdoutBuf);
        handle.sessionId = sessionIdRef.value;
        resolve(code);
      });
      child.on("error", (err) => {
        console.error(`[omp:error] ${err.message}`);
        resolve(null);
      });
    }),
    events,
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
