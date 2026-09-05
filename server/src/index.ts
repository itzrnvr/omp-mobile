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
import { join, dirname, isAbsolute, resolve } from "node:path";
import { mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { listSessions, getSessionHistory, getMobileHistory, findSessionFile } from "./sessions.ts";
import { deleteSession, forkSession } from "./sessions.ts";
import { renameSession } from "./sessions.ts";
import { startTunnel, stopTunnel, getTunnelState } from "./tunnel.ts";
import { loadModelCatalog, refreshModelCatalog, warmModelCatalog } from "./models.ts";
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
    models: loadModelCatalog(),
  };
}

function sendWs(ws: WebSocket, msg: WsServerMessage): void {
  ws.send(JSON.stringify(msg));
}

/** Tell every connected client that a session has a live omp run (or not). */
function broadcastSessionActive(sessionId: string, active: boolean): void {
  if (!sessionId) return;
  for (const c of connections) {
    if (c.readyState === 1) sendWs(c, { type: "session_active", sessionId, active });
  }
}

async function handleSend(
  ws: WebSocket,
  state: ConnectionState,
  cmd: { content: string; sessionId?: string | null; model?: string; thinking?: string; autoApprove?: boolean; cwd?: string },
): Promise<void> {
  // KV-CACHE SAFETY + true steering: if the TUI (extension) owns this session,
  // NEVER spawn a second omp --resume (divergent prefix wrecks the provider
  // KV/prefix cache lineage). Route the send INTO the running TUI turn as a
  // steering message — same semantics as typing in the TUI while it answers.
  // TUI-owned session: route the send INTO the TUI as steering via the
  // extension (queue + agent_end-hook delivery). Never spawn a second omp —
  // that would branch the session tree and wreck KV lineage.
  // TUI-owned session: the TUI is the single writer (KV-cache lineage +
  // session-tree safety). App sends here are refused with an actionable
  // message; the app toasts and offers fork. TUI->app stays fully live via
  // extension events. (ext_steer injection proven unavailable: omp
  // sendUserMessage no-ops outside hook context AND bridge->ext socket
  // delivery dropped frames in testing, 2026-09-05.)
  if (extOwnerWs(cmd.sessionId)) {
    sendWs(ws, {
      type: 'error',
      message:
        'Live in the omp TUI right now - it is the single writer for this session. Reply there, or fork it here to branch safely.',
    });
    return;
  }
  if (state.ompKill) {
    state.ompKill();
  }

  let sessionId = cmd.sessionId || "";
  let announced = false;
  if (sessionId) {
    announced = true;
    broadcastSessionActive(sessionId, true);
  }

  const handle = spawnOmp({
    content: cmd.content,
    sessionId: cmd.sessionId || undefined,
    model: cmd.model,
    thinking: cmd.thinking,
    autoApprove: cmd.autoApprove,
    approvalMode: cmd.approvalMode,
    cwd: cmd.cwd,
    // Stream each event to the client as it arrives (live token deltas).
    onEvent: (event) => {
      if (event.type === "session" && "id" in event && typeof event.id === "string") {
        sessionId = event.id;
        state.currentSessionId = sessionId;
        if (!announced) {
          announced = true;
          broadcastSessionActive(sessionId, true);
        }
      }
      if (ws.readyState === 1) {
        sendWs(ws, { type: "event", sessionId, event });
      }
    },
  });

  state.ompKill = handle.kill;

  try {
    await handle.done;

    sessionId = handle.sessionId || sessionId;
    if (sessionId) state.currentSessionId = sessionId;

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
    broadcastSessionActive(sessionId || handle.sessionId || "", false);
  }
}

async function handleCommand(ws: WebSocket, state: ConnectionState, cmd: WsClientCommand): Promise<void> {
  switch (cmd.type) {
    case "send":
      await handleSend(ws, state, cmd);
      break;

    case "cancel": {
      const cancelOwner = extOwnerWs(state.currentSessionId);
      if (cancelOwner) {
        sendWs(cancelOwner, { type: 'ext_abort' });
        sendWs(ws, { type: 'error', message: 'Abort forwarded to the omp TUI' });
        break;
      }
      if (state.ompKill) {
        state.ompKill();
        state.ompKill = null;
        sendWs(ws, { type: "error", message: "Cancelled by user" });
      }
      break;
    }

    case "list_sessions": {
      const sessions: SessionSummary[] = await listSessions();
      sendWs(ws, { type: "sessions", sessions });
      break;
    }

    case "get_history": {
      // (watcher started after the reply below)
      const result = await getMobileHistory(cmd.sessionId);
      if (result) {
        sendWs(ws, {
          type: "history",
          sessionId: cmd.sessionId,
          messages: result.messages,
          title: result.title,
          truncated: result.truncated,
          totalCount: result.totalCount,
        });
      } else {
        sendWs(ws, { type: "error", message: `Session not found: ${cmd.sessionId}` });
      }
      startSessionWatcher(ws, cmd.sessionId, state);
      break;
    }

    case "get_status": {
      const status = await buildStatus();
      sendWs(ws, { type: "status", status });
      break;
    }

    case "refresh_models": {
      // Explicit catalog refresh (forces the omp CLI call); reply with status.
      await refreshModelCatalog();
      const status = await buildStatus();
      sendWs(ws, { type: "status", status });
      break;
    }

    case "start_tunnel":
    case "fork_session": {
      const newId = forkSession(cmd.sessionId, cmd.messageCount);
      if (newId) {
        const sessions = await listSessions();
        sendWs(ws, { type: "forked", sessionId: newId, sessions });
      } else {
        sendWs(ws, { type: "error", message: `Fork failed: ${cmd.sessionId}` });
      }
      break;
    }

    case "delete_session": {
      const ok = deleteSession(cmd.sessionId);
      const sessions = await listSessions();
      if (ok) {
        sendWs(ws, { type: "deleted", sessionId: cmd.sessionId, sessions });
      } else {
        sendWs(ws, { type: "error", message: `Delete failed: ${cmd.sessionId}` });
      }
      break;
    }

    case "rename_session": {
      const ok = renameSession(cmd.sessionId, cmd.title);
      const sessions = await listSessions();
      if (ok) {
        sendWs(ws, { type: "renamed", sessionId: cmd.sessionId, sessions });
      } else {
        sendWs(ws, { type: "error", message: `Rename failed: ${cmd.sessionId}` });
      }
      break;
    }

    case "upload": {
      try {
        const dir = join(cmd.cwd || process.cwd(), ".attachments");
        mkdirSync(dir, { recursive: true });
        const safeName = cmd.name.replace(/[^\w.\-]/g, "_");
        const path = join(dir, safeName);
        writeFileSync(path, Buffer.from(cmd.data, "base64"));
        sendWs(ws, { type: "uploaded", path });
      } catch (err) {
        sendWs(ws, {
          type: "error",
          message: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
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

// ─── External session sync (2026-09-05) ─────────────────────────────────────
// Sessions can be live in another omp instance (desktop TUI). The bridge
// polls the session JSONL and re-pushes history on change so the mobile app
// mirrors TUI activity in near-real-time (~1s). Skipped while THIS connection
// drives its own omp process (live events already stream).
const sessionWatchers = new Map<
  WebSocket,
  { sessionId: string; timer: ReturnType<typeof setInterval> | null; lastMtime: number }
>();

// ─── Extension (TUI) live-sync connections (2026-09-05) ────────────────────
// The omp-mobile-sync extension inside a running TUI mirrors every streaming
// event here; we rebroadcast to mobile clients for token-level sync.
// KV-CACHE SAFETY: a session with a live extension is SINGLE-WRITER (the TUI).
// Mobile sends for it are refused (fork instead) so no second omp process can
// diverge the prompt prefix and break the provider KV/prefix cache lineage.
const extConns = new Map<WebSocket, { sessionId: string | null }>();
const extRunning = new Map<string, boolean>();
const extLastEvent = new Map<string, number>();

function extIsRunning(sessionId: string | null | undefined): boolean {
  return !!sessionId && extRunning.get(sessionId) === true;
}

// Deterministic single-writer rule: if ANY live extension connection owns this
// session (TUI has it open), the TUI is the writer — mobile must fork. Covers
// the race where a TUI turn starts right after a mobile send would spawn.
function extOwns(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  for (const c of extConns.values()) if (c.sessionId === sessionId) return true;
  return false;
}

function extOwnerWs(sessionId: string | null | undefined): WebSocket | null {
  if (!sessionId) return null;
  for (const [ws, c] of extConns) if (c.sessionId === sessionId) return ws;
  return null;
}

function extRecentlyActive(sessionId: string | null | undefined, ms = 2000): boolean {
  if (!sessionId) return false;
  const at = extLastEvent.get(sessionId);
  return !!at && Date.now() - at < ms;
}

function broadcastMobile(msg: Record<string, unknown>): void {
  for (const c of connections.keys()) sendWs(c, msg);
}

function handleExtMessage(ws: WebSocket, raw: string): void {
  let m: { type?: string; sessionId?: string | null; event?: Record<string, unknown> };
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  const conn = extConns.get(ws);
  if (!conn) return;
  if (m.type === 'ext_hello') {
    conn.sessionId = m.sessionId || null;
    if (conn.sessionId) extLastEvent.set(conn.sessionId, Date.now());
    broadcastMobile({ type: 'ext_session', sessionId: conn.sessionId, active: true });
    console.log(`[ext] hello session=${(conn.sessionId || 'none').slice(0, 8)}`);
    return;
  }
  if (m.type === 'ext_bye') {
    const sid = conn.sessionId;
    if (sid) {
      extRunning.set(sid, false);
      broadcastMobile({ type: 'ext_session', sessionId: sid, active: false });
    }
    return;
  }
  if (m.type === 'ext_event') {
    const sid = m.sessionId || conn.sessionId;
    if (!sid) return;
    conn.sessionId = sid;
    extLastEvent.set(sid, Date.now());
    const ev = m.event || {};
    if (ev.type === 'agent_start') extRunning.set(sid, true);
    if (ev.type === 'agent_end') extRunning.set(sid, false);
    broadcastMobile({ type: 'ext_event', sessionId: sid, event: ev });
  }
}

function stopSessionWatcher(ws: WebSocket): void {
  const w = sessionWatchers.get(ws);
  if (w?.timer) clearInterval(w.timer);
  sessionWatchers.delete(ws);
}

function startSessionWatcher(ws: WebSocket, sessionId: string, state: ConnectionState): void {
  stopSessionWatcher(ws);
  const entry = { sessionId, timer: null as ReturnType<typeof setInterval> | null, lastMtime: 0 };
  sessionWatchers.set(ws, entry);
  const tick = async () => {
    if (state.ompKill) return;
    if (extIsRunning(sessionId) || extRecentlyActive(sessionId)) return;
    try {
      const file = await findSessionFile(sessionId);
      if (!file) return;
      const st = statSync(file);
      if (st.mtimeMs === entry.lastMtime) return;
      entry.lastMtime = st.mtimeMs;
      const hist = await getMobileHistory(sessionId);
      if (!hist || ws.readyState !== WebSocket.OPEN) return;
      console.log(`[watcher] push ${hist.messages.length} msgs for ${sessionId.slice(0,8)} ext=${Date.now() - st.mtimeMs < 5000}`);
      const externallyActive = Date.now() - st.mtimeMs < 5000;
      sendWs(ws, {
        type: "history",
        sessionId,
        messages: hist.messages,
        title: hist.title,
        truncated: hist.truncated,
        totalCount: hist.totalCount,
        externallyActive,
      });
    } catch {
      // file vanished / unreadable — keep polling
    }
  };
  entry.timer = setInterval(() => void tick(), 900);
  void tick();
}

/**
 * Directory listing for the mobile folder picker.
 * Empty path = drive roots on Windows (else home). Hidden dirs skipped.
 */
function listDirs(p: string): {
  path: string;
  parent: string | null;
  home: string;
  dirs: { name: string; path: string }[];
} {
  const home = homedir();
  if (!p) {
    if (process.platform === "win32") {
      const dirs: { name: string; path: string }[] = [];
      for (let d = 65; d <= 90; d++) {
        const root = String.fromCharCode(d) + ":\\";
        try {
          if (statSync(root).isDirectory()) dirs.push({ name: root, path: root });
        } catch {
          // drive absent
        }
      }
      return { path: "", parent: null, home, dirs };
    }
    p = home;
  }
  const abs = resolve(p);
  let dirs: { name: string; path: string }[] = [];
  try {
    dirs = readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: join(abs, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } catch {
    // unreadable dir → empty list
  }
  const parent = dirname(abs);
  return {
    path: abs,
    parent: parent === abs ? null : parent,
    home,
    dirs,
  };
}

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

  // Folder picker backend (2026-09-05): list directories + create folders so
  // the mobile app gets a real navigator instead of a text input.
  if (url.pathname === "/api/fs" && req.method === "GET") {
    const p = url.searchParams.get("path") || "";
    return new Response(JSON.stringify(listDirs(p)), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/fs/mkdir" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { path?: string };
    const target = body.path || "";
    try {
      if (!target || !isAbsolute(target)) throw new Error("bad path");
      mkdirSync(target, { recursive: true });
      return new Response(JSON.stringify(listDirs(dirname(target))), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
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
      const data = (ws as unknown as { data?: { ext?: boolean } }).data;
      if (data?.ext) {
        extConns.set(ws, { sessionId: null });
        console.log(`[ext] connected (${extConns.size} total)`);
        return;
      }
      connections.set(ws, {
        ompKill: null,
        currentSessionId: null,
      });
      console.log(`[ws] client connected (${connections.size} total)`);
      // Push status immediately so every client shows server + tunnel state on connect.
      void buildStatus().then((status) => sendWs(ws, { type: "status", status }));
      // Sync TUI-ownership state so the single-writer guard is correct even
      // if the client missed earlier ext_session broadcasts (reconnects).
      for (const c of extConns.values()) {
        if (c.sessionId) sendWs(ws, { type: "ext_session", sessionId: c.sessionId, active: true });
      }
    },

    async message(ws: WebSocket, message: string | Buffer) {
      if (extConns.has(ws)) {
        handleExtMessage(ws, typeof message === 'string' ? message : message.toString());
        return;
      }
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
      if (extConns.has(ws)) {
        const sid = extConns.get(ws)?.sessionId;
        extConns.delete(ws);
        if (sid) {
          extRunning.set(sid, false);
          broadcastMobile({ type: 'ext_session', sessionId: sid, active: false });
        }
        console.log(`[ext] disconnected (${extConns.size} total)`);
        return;
      }
      const state = connections.get(ws);
      if (state?.ompKill) {
        state.ompKill();
      }
      stopSessionWatcher(ws);
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

      const upUrl = new URL(req.url);
      const success = server.upgrade(req, { data: { ext: upUrl.pathname === '/ext' } });
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

// Warm the session header cache at boot so the first drawer open is instant
// (otherwise the first list_sessions parses ~600 JSONL files cold, ~2s).
void listSessions().then((s) => console.log(`[sessions] cache warmed: ${s.length}`));
// Warm the omp model catalog (CLI call is slow; first status must be instant).
warmModelCatalog();
