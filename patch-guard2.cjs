const fs = require("fs");
const p = "D:/omp-mobile/server/src/index.ts";
let t = fs.readFileSync(p, "utf8");

// 1. dead-socket-safe owner lookup + prune
const oldOwner =
  "function extOwnerWs(sessionId: string | null | undefined): WebSocket | null {\n" +
  "  if (!sessionId) return null;\n" +
  "  for (const [ws, c] of extConns) if (c.sessionId === sessionId) return ws;\n" +
  "  return null;\n" +
  "}";
const newOwner =
  "function extOwnerWs(sessionId: string | null | undefined): WebSocket | null {\n" +
  "  if (!sessionId) return null;\n" +
  "  for (const [ws, c] of extConns) {\n" +
  "    // Dead/half-open sockets must never own a session: transient omp\n" +
  "    // processes exit without a clean close and would otherwise block\n" +
  "    // mobile sends forever (2026-09-05).\n" +
  "    if (c.sessionId === sessionId) {\n" +
  "      if (ws.readyState === 1) return ws;\n" +
  "      extConns.delete(ws);\n" +
  "    }\n" +
  "  }\n" +
  "  return null;\n" +
  "}\n" +
  "\n" +
  "// Periodic prune of dead ext sockets (close events can be missed).\n" +
  "setInterval(() => {\n" +
  "  for (const [ws] of extConns) if (ws.readyState !== 1) extConns.delete(ws);\n" +
  "}, 30000);";
if (!t.includes(oldOwner)) { console.log("OWNER MISS"); process.exit(1); }
t = t.replace(oldOwner, newOwner);

// 2. honest guard: no ext_steer routing (transport to ext sockets proven
//    unreliable this omp build); refuse with actionable error instead.
const oldRoute =
  "  const ownerWs = extOwnerWs(cmd.sessionId);\n" +
  "  if (ownerWs) {\n" +
  "    sendWs(ownerWs, { type: 'ext_steer', content: cmd.content });\n" +
  "    sendWs(ws, { type: 'steered', sessionId: cmd.sessionId || null });\n" +
  "    return;\n" +
  "  }";
const newRoute =
  "  // TUI-owned session: the TUI is the single writer (KV-cache lineage +\n" +
  "  // session-tree safety). App sends here are refused with an actionable\n" +
  "  // message; the app toasts and offers fork. TUI->app stays fully live via\n" +
  "  // extension events. (ext_steer injection proven unavailable: omp's\n" +
  "  // sendUserMessage no-ops outside hook context AND bridge->ext socket\n" +
  "  // delivery dropped frames in testing, 2026-09-05.)\n" +
  "  if (extOwnerWs(cmd.sessionId)) {\n" +
  "    sendWs(ws, {\n" +
  "      type: 'error',\n" +
  "      message:\n" +
  "        'Live in the omp TUI right now - it is the single writer for this session. Reply there, or fork it here to branch safely.',\n" +
  "    });\n" +
  "    return;\n" +
  "  }";
if (!t.includes(oldRoute)) { console.log("ROUTE MISS"); process.exit(1); }
t = t.replace(oldRoute, newRoute);
fs.writeFileSync(p, t);
console.log("honest guard + prune ok");
