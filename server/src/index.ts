/*
 * PURPOSE: Main bridge server entry point. Combines WebSocket (for real-time
 * OMP event streaming) and REST API (for session listing and status) into a
 * single Bun.serve instance. Also manages the Cloudflare tunnel for remote access.
 *
 * KEY DECISIONS:
 * - Single port (default 9090) serves both HTTP REST and WebSocket.
 * - Token-based auth: a random token is generated on startup and printed to console.
 *   Clients send it via the `Authorization` header or `?token=` query param.
 * - Each WebSocket connection can manage one active OMP process at a time.
 * - OMP is spawned with `--mode=json -p` per message; events are forwarded as-is.
 *
 * ARCHITECTURE:
 *   Mobile App ←→ WebSocket ←→ Bridge Server ←→ OMP CLI (stdin/stdout JSON)
 *                                       ↕
 *                              Cloudflare Tunnel → Internet
 */

import { spawnOmp, getOmpVersion } from "./omp.ts";
import { listSessions, getSessionHistory } from "./sessions.ts";
import { startTunnel, stopTunnel, getTunnelState } from "./tunnel.ts";
import type {
  WsClientCommand,
  WsServerMessage,
  ServerStatus,
  SessionSummary,
} from "./types.ts";

const PORT = parseInt(process.env.OMP_BRIDGE_PORT || "9090", 10);
const AUTH_TOKEN = process.env.OMP_BRIDGE_TOKEN || "omp-mobile-personal-2026";

interface ConnectionState {
  ompKill: (() => void) | null;
  currentSessionId: string | null;
}

const connections = new Map<WebSocket, ConnectionState>();
const startTime = Date.now();

function checkAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (authHeader === `Bearer ${AUTH_TOKEN}`) return true;

  const url = new URL(req.url);
  const tokenParam = url.searchParams.get("token");
  return tokenParam === AUTH_TOKEN;
}

async function buildStatus(): Promise<ServerStatus> {
  const ompVersion = await getOmpVersion();
  const tunnel = getTunnelState();
  const sessions = await listSessions();

  return {
    ompVersion,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    tunnelUrl: tunnel.url,
    tunnelStatus: tunnel.status,
    activeSessions: connections.size,
    totalSessions: sessions.length,
    models: [],
  };
}

function sendWs(ws: WebSocket, msg: WsServerMessage): void {
  ws.send(JSON.stringify(msg));
}

async function handleSend(
  ws: WebSocket,
  state: ConnectionState,
  cmd: { content: string; sessionId?: string | null; model?: string; thinking?: string; autoApprove?: boolean; cwd?: string },
): Promise<void> {
  if (state.ompKill) {
    state.ompKill();
  }

  const handle = spawnOmp({
    content: cmd.content,
    sessionId: cmd.sessionId || undefined,
    model: cmd.model,
    thinking: cmd.thinking,
    autoApprove: cmd.autoApprove,
    cwd: cmd.cwd,
  });

  state.ompKill = handle.kill;

  try {
    await handle.done;

    // Forward all events synchronously after process exits
    const sessionId = handle.sessionId || cmd.sessionId || "";
    if (sessionId) state.currentSessionId = sessionId;

    for (const event of handle.events) {
      if (ws.readyState !== 1) break; // 1 = OPEN (ServerWebSocket.OPEN may be undefined in Bun)
      sendWs(ws, { type: "event", sessionId, event });
    }

    sendWs(ws, {
      type: "complete",
      sessionId,
    });
  } catch (err) {
    sendWs(ws, {
      type: "error",
      message: `OMP process error: ${err instanceof Error ? err.message : String(err)}`,
      sessionId: handle.sessionId || cmd.sessionId || undefined,
    });
  } finally {
    state.ompKill = null;
  }
}

async function handleCommand(ws: WebSocket, state: ConnectionState, cmd: WsClientCommand): Promise<void> {
  switch (cmd.type) {
    case "send":
      await handleSend(ws, state, cmd);
      break;

    case "cancel":
      if (state.ompKill) {
        state.ompKill();
        state.ompKill = null;
        sendWs(ws, { type: "error", message: "Cancelled by user" });
      }
      break;

    case "list_sessions": {
      const sessions: SessionSummary[] = await listSessions();
      sendWs(ws, { type: "sessions", sessions });
      break;
    }

    case "get_history": {
      const result = await getSessionHistory(cmd.sessionId);
      if (result) {
        sendWs(ws, {
          type: "history",
          sessionId: cmd.sessionId,
          messages: result.messages,
          title: result.title,
        });
      } else {
        sendWs(ws, { type: "error", message: `Session not found: ${cmd.sessionId}` });
      }
      break;
    }

    case "get_status": {
      const status = await buildStatus();
      sendWs(ws, { type: "status", status });
      break;
    }

    case "start_tunnel":
      sendWs(ws, { type: "tunnel", url: null, status: "starting" });
      {
        const tunnelState = await startTunnel(PORT);
        sendWs(ws, { type: "tunnel", url: tunnelState.url, status: tunnelState.status });
      }
      break;

    case "stop_tunnel": {
      const tunnelState = stopTunnel();
      sendWs(ws, { type: "tunnel", url: tunnelState.url, status: tunnelState.status });
      break;
    }

    default:
      sendWs(ws, { type: "error", message: `Unknown command type: ${(cmd as { type: string }).type}` });
  }
}

// ─── HTTP REST API ────────────────────────────────────────────────────────────

async function handleRest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (!checkAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/status" && req.method === "GET") {
    const status = await buildStatus();
    return new Response(JSON.stringify(status), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/sessions" && req.method === "GET") {
    const sessions = await listSessions();
    return new Response(JSON.stringify(sessions), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([0-9a-f-]+)$/);
  if (sessionMatch && req.method === "GET") {
    const result = await getSessionHistory(sessionMatch[1]);
    if (!result) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/tunnel/start" && req.method === "POST") {
    const state = await startTunnel(PORT);
    return new Response(JSON.stringify(state), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/tunnel/stop" && req.method === "POST") {
    const state = stopTunnel();
    return new Response(JSON.stringify(state), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/auth/token" && req.method === "GET") {
    return new Response(JSON.stringify({ token: AUTH_TOKEN }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,

  websocket: {
    open(ws: WebSocket) {
      connections.set(ws, {
        ompKill: null,
        currentSessionId: null,
      });
      console.log(`[ws] client connected (${connections.size} total)`);
      // Push status immediately so every client shows server + tunnel state on connect.
      void buildStatus().then((status) => sendWs(ws, { type: "status", status }));
    },

    async message(ws: WebSocket, message: string | Buffer) {
      const state = connections.get(ws);
      if (!state) return;

      let cmd: WsClientCommand;
      try {
        cmd = JSON.parse(typeof message === "string" ? message : message.toString()) as WsClientCommand;
      } catch {
        sendWs(ws, { type: "error", message: "Invalid JSON command" });
        return;
      }

      await handleCommand(ws, state, cmd);
    },

    close(ws: WebSocket) {
      const state = connections.get(ws);
      if (state?.ompKill) {
        state.ompKill();
      }
      connections.delete(ws);
      console.log(`[ws] client disconnected (${connections.size} total)`);
    },
  },

  async fetch(req: Request, server): Promise<Response> {
    // WebSocket upgrade
    if (req.headers.get("Upgrade") === "websocket") {
      if (!checkAuth(req)) {
        return new Response("Unauthorized", { status: 401 });
      }

      const success = server.upgrade(req);
      if (success) return undefined as unknown as Response;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    const response = await handleRest(req);
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return response;
  },
});

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║         OMP Bridge Server v1.0.0                     ║");
console.log("╠══════════════════════════════════════════════════════╣");
console.log(`║  Local:   http://localhost:${PORT}                     ║`);
console.log(`║  WS:      ws://localhost:${PORT}/?token=...           ║`);
console.log(`║  Token:   ${AUTH_TOKEN.slice(0, 8)}...${AUTH_TOKEN.slice(-4)}                        ║`);
console.log("║  Tunnel:  stopped (use /api/tunnel/start or WS)     ║");
console.log("╚══════════════════════════════════════════════════════╝");
console.log("");
console.log("Full auth token:", AUTH_TOKEN);
console.log("Press Ctrl+C to stop");

// Auto-start the Cloudflare tunnel so remote clients can bootstrap without manual entry.
void startTunnel(PORT).then((state) => {
  console.log(`[tunnel] auto-start: ${state.status}${state.url ? " " + state.url : ""}`);
});
