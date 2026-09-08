/**
 * omp-mobile-sync — pure-observer bridge tap for OMP Mobile (2026-09-05).
 *
 * PURPOSE: give the mobile app token-level realtime sync of a session that is
 * running in this TUI. Every streaming event is mirrored over a WebSocket to
 * the bridge server (ws://127.0.0.1:<port>/ext), which rebroadcasts to mobile
 * clients watching the same session.
 *
 * HARD RULES (do not relax):
 *  - OBSERVER ONLY: handlers return void and mutate nothing (no ctx calls,
 *    no provider-request edits). The TUI's conversation, model, thinking and
 *    KV-cache lineage must be bit-identical with or without this extension.
 *  - NEVER throw: every handler body is try/catch; WS failures are silent.
 *    A broken sync must never break the TUI.
 *  - Fire-and-forget: no awaited network calls inside hooks.
 *  - Single writer stays the TUI: the bridge refuses mobile sends for a
 *    session with a live extension connection (KV/prefix-cache safety).
 *
 * EVENTS FORWARDED (shape matches omp --mode=json so the mobile client can
 * reuse its live pipeline verbatim):
 *   agent_start/agent_end/turn_start/turn_end      -> {type}
 *   message_start/message_end                      -> {type, message}
 *   message_update                                 -> {type, assistantMessageEvent}
 *   tool_execution_start/end                       -> {type:'custom', customType, data}
 *   session_start/switch/branch                    -> ext_hello (re-register id)
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { appendFileSync } from "node:fs";

const ERRLOG = "D:/omp-mobile/ext-errors.log";
// Bump when the bridge<->extension protocol changes; the bridge only routes
// steering to owners whose hello matches, so stale-code processes can never
// false-ack a steer (2026-09-05).
const EXT_PROTO = 2;
const log = (s: string) => {
  try {
    appendFileSync(ERRLOG, new Date().toISOString() + " " + s + "\n");
  } catch {
    /* never break the TUI */
  }
};

const PORT = Number(process.env.OMP_MOBILE_BRIDGE_PORT || 9090);
const TOKEN =
  process.env.OMP_MOBILE_BRIDGE_TOKEN ||
  process.env.OMP_BRIDGE_TOKEN ||
  "omp-mobile-personal-2026";
const URL = `ws://127.0.0.1:${PORT}/ext?token=${encodeURIComponent(TOKEN)}`;

let ws: WebSocket | null = null;
let closed = false;
let retry = 0;
let sessionId: string | null = null;
// Factory-scoped ExtensionAPI for the WS handler (module-level connect()
// cannot see the factory param — this ReferenceError silently killed every
// steer attempt until logging exposed it, 2026-09-05).
let api: ExtensionAPI | null = null;
// Latest event ctx (for abort); sendUserMessage lives on the pi API itself.
let lastCtx: { abort?: () => void; isIdle?: () => boolean } | null = null;
// Steer messages queued by the mobile app; delivered from inside event hooks
// (sendUserMessage is a no-op from plain WS callbacks, 2026-09-05 finding).)
const pendingSteers: string[] = [];
// True between agent_start and agent_end of THIS TUI (mid-turn vs idle).
let tuiRunning = false;
// Idempotency flag for the onEntryAppended wrap (symbol-ish key on the sm).
const WRAP_FLAG = "__ompMobileEntryWrapped";

function connect(): void {
  if (closed) return;
  try {
    const W = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    if (!W) return;
    ws = new W(URL);
    ws.onopen = () => {
      retry = 0;
      post({ type: "ext_hello", sessionId, proto: EXT_PROTO, running: tuiRunning });
    };
    ws.onmessage = (ev: MessageEvent) => {
      // Bridge forwards app sends for THIS session as steering injections.
      try {
        const m = JSON.parse(String(ev.data)) as {
          type?: string;
          content?: string;
        };
        if (m.type === "ext_steer" && typeof m.content === "string") {
          const mode = tuiRunning ? "mid" : "idle";
          post({ type: "ext_steer_ack", mode });
          // Try immediate injection. ONLY clear the queue if it did not
          // throw: a silent no-op must fall through to the agent_end hook
          // (2026-09-05 advisor: the old code cleared on no-op and the steer
          // vanished). Errors are logged, never swallowed silently.
          if (mode === "idle") {
            pendingSteers.push(m.content);
            log("ext_steer: idle -> queued for boundary hook");
            return;
          }
          pendingSteers.push(m.content);
          try {
            const fn = (api as unknown as Record<string, unknown> | null)?.sendUserMessage;
            if (typeof fn !== "function") {
              log("ext_steer: pi.sendUserMessage MISSING on runtime pi");
            } else {
              (api as ExtensionAPI).sendUserMessage(m.content, { deliverAs: "steer" });
              // With api assigned, no-throw == delivered (proven 2026-09-05:
              // retaining the queue caused a duplicate injection at the
              // boundary). Clear here; hook only fires for threw/missing.
              pendingSteers.length = 0;
              log("ext_steer: immediate delivered, queue cleared");
            }
          } catch (e) {
            log("ext_steer: THREW " + String(e));
          }
        } else if (m.type === "ext_abort") {
          lastCtx?.abort?.();
        }
      } catch {
        /* never break the TUI */
      }
    };
    ws.onclose = () => {
      ws = null;
      if (closed) return;
      retry = Math.min(retry + 1, 5);
      setTimeout(connect, 1000 * 2 ** (retry - 1));
    };
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    setTimeout(connect, 5000);
  }
}

function post(obj: Record<string, unknown>): void {
  try {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
      postCount++;
      if (postCount % 200 === 1) {
        log("post: sent #" + postCount + " type=" + String(obj.type) + " rs=" + ws.readyState);
      }
    } else {
      dropCount++;
      if (dropCount % 50 === 1) {
        log("post: DROPPED #" + dropCount + " type=" + String(obj.type) + " ws=" + (ws ? "rs" + ws.readyState : "null"));
      }
    }
  } catch {
    /* drop — watcher fallback covers gaps */
  }
}

let postCount = 0;
let dropCount = 0;

function sid(ctx: { sessionManager?: { sessionId?: string } }): string | null {
  try {
    const sm = ctx?.sessionManager as { getSessionId?: () => string } | undefined;
    const id = (sm && typeof sm.getSessionId === "function" ? sm.getSessionId() : null) || null;
    if (id && id !== sessionId) {
      sessionId = id;
      post({ type: "ext_hello", sessionId: id, proto: EXT_PROTO });
    }
    return sessionId;
  } catch {
    return sessionId;
  }
}

function fwd(
  ctx: { sessionManager?: { sessionId?: string } },
  event: Record<string, unknown>,
): void {
  try {
    post({ type: "ext_event", sessionId: sid(ctx), event });
  } catch {
    /* ignore */
  }
}

/**
 * Realtime interception framework: chain-wrap SessionManager.onEntryAppended
 * so EVERY persisted entry (messages, model_change, compaction, steers,
 * branches) is mirrored to the bridge the moment it lands.
 *
 * The TUI assigns its own sink AFTER session_start (observed: own field, not
 * yet a function, then a later plain assignment) — a plain wrap would be
 * silently overwritten. So install an intercepting ACCESSOR: any later
 * assignment is captured as `inner` and still chained, and every read gets
 * the mirroring wrapper. Idempotent per SessionManager instance.
 */
function wrapEntrySink(ctx: { sessionManager?: unknown }): void {
  try {
    const sm = ctx.sessionManager as Record<string, unknown> | undefined;
    if (!sm || sm[WRAP_FLAG]) return;
    let inner: ((e: unknown) => void) | null =
      typeof sm.onEntryAppended === "function"
        ? (sm.onEntryAppended as (e: unknown) => void)
        : null;
    const wrapper = (entry: unknown) => {
      if (inner) {
        try {
          inner(entry);
        } catch {
          /* original sink errors must not break ours, and vice versa */
        }
      }
      try {
        let leafId: string | null = null;
        try {
          const gl = sm.getLeafId;
          if (typeof gl === "function") {
            leafId = (gl as () => string | null).call(sm);
          }
        } catch {
          /* leafId is optional enrichment */
        }
        post({
          type: "ext_entry",
          sessionId: sessionId,
          leafId: leafId,
          entry: entry as Record<string, unknown>,
        });
      } catch {
        /* never break the TUI */
      }
    };
    Object.defineProperty(sm, "onEntryAppended", {
      configurable: true,
      enumerable: true,
      get: () => wrapper,
      set: (fn: unknown) => {
        inner = typeof fn === "function" ? (fn as (e: unknown) => void) : null;
      },
    });
    sm[WRAP_FLAG] = true;
    log("wrapEntrySink: accessor installed (inner=" + (inner ? "yes" : "no") + ")");
  } catch (e) {
    log("wrapEntrySink THREW " + String(e));
  }
}

export default function (pi: ExtensionAPI): void {
  try {
    api = pi;
    log("factory load marker RELOAD-MARKER-1788659455");
    // ONLY in the interactive TUI. Subcommand runs (models ls, acp, ps, mcp)
    // also load extensions; a WS reconnect timer there would keep the CLI
    // process alive forever (and wedge the bridge spawnSync at boot).
    const argv = process.argv.slice(2);
    const subcmd = ["models", "acp", "ps", "mcp", "lsp", "serve", "relay"];
    const interactive =
      !!process.stdout.isTTY && !argv.includes("-p") && !subcmd.includes(argv[0] || "");
    if (!interactive) return;
    connect();

    pi.on("session_start", (_e, ctx) => {
      lastCtx = ctx as { abort?: () => void; isIdle?: () => boolean };
      sid(ctx);
      wrapEntrySink(ctx as { sessionManager?: unknown });
    });
    pi.on("session_switch", (_e, ctx) => {
      sid(ctx);
      wrapEntrySink(ctx as { sessionManager?: unknown });
    });
    pi.on("session_branch", (_e, ctx) => {
      sid(ctx);
      wrapEntrySink(ctx as { sessionManager?: unknown });
    });
    pi.on("session_shutdown", () => {
      post({ type: "ext_bye", sessionId });
    });

    pi.on("agent_start", (_e, ctx) => {
      tuiRunning = true;
      wrapEntrySink(ctx as { sessionManager?: unknown });
      lastCtx = ctx as { abort?: () => void };
      fwd(ctx, { type: "agent_start" });
    });
    pi.on("agent_end", (_e, ctx) => {
      tuiRunning = false;
      // Hook context: the only place sendUserMessage reliably lands. Deliver
      // queued mobile steers at the turn boundary (TUI steering semantics).
      while (pendingSteers.length > 0) {
        const content = pendingSteers.shift();
        if (!content) break;
        try {
          (api as ExtensionAPI).sendUserMessage(content, { deliverAs: "followUp" });
          log("agent_end hook: delivered followUp steer");
        } catch (e) {
          log("agent_end hook: THREW " + String(e));
        }
      }
      fwd(ctx, { type: "agent_end" });
    });
    pi.on("turn_start", (_e, ctx) => fwd(ctx, { type: "turn_start" }));
    pi.on("turn_end", (_e, ctx) => fwd(ctx, { type: "turn_end" }));

    pi.on("message_start", (e, ctx) =>
      fwd(ctx, { type: "message_start", message: e.message }),
    );
    pi.on("message_end", (e, ctx) => {
      lastCtx = ctx as { abort?: () => void; isIdle?: () => boolean };
      fwd(ctx, { type: "message_end", message: e.message });
    });
    pi.on("message_update", (e, ctx) => {
      lastCtx = ctx as { abort?: () => void };
      fwd(ctx, {
        type: "message_update",
        assistantMessageEvent: e.assistantMessageEvent,
      });
    });

    pi.on("tool_execution_start", (e, ctx) =>
      fwd(ctx, {
        type: "custom",
        customType: "tool_execution_start",
        data: { toolCallId: e.toolCallId, toolName: e.toolName, args: e.args },
      }),
    );
    pi.on("tool_execution_end", (e, ctx) =>
      fwd(ctx, {
        type: "custom",
        customType: "tool_execution_end",
        data: {
          toolCallId: e.toolCallId,
          toolName: e.toolName,
          isError: (e as { isError?: boolean }).isError,
        },
      }),
    );
  } catch {
    /* extension must never break the TUI */
  }
}
