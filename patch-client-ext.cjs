/* One-shot patch: client-side ext_event live pipeline + send guard + banner. */
const fs = require("fs");

// ---- types.ts ----
let p = "D:/omp-mobile/mobile/src/types.ts";
let t = fs.readFileSync(p, "utf8");
const tOld = "  | { type: 'refresh_models' }";
const tNew = [
  "  | { type: 'refresh_models' }",
].join("\n");
// server->client variants live in WsServerMessage; find its union end marker
const sOld = "  | { type: 'uploaded'; path: string };";
const sNew = [
  "  | { type: 'uploaded'; path: string }",
  "  | { type: 'ext_event'; sessionId: string; event: OmpEvent }",
  "  | { type: 'ext_session'; sessionId: string | null; active: boolean };",
].join("\n");
if (!t.includes(sOld)) fail("TYPES SERVER UNION MISS");
t = t.replace(sOld, sNew);
fs.writeFileSync(p, t);

// ---- store ----
p = "D:/omp-mobile/mobile/src/store/index.ts";
t = fs.readFileSync(p, "utf8");

// state + interface
t = t.replace(
  "  /** True while the open session is live in another omp instance (TUI). */\n  externalActive: boolean;",
  "  /** True while the open session is live in another omp instance (TUI). */\n  externalActive: boolean;\n  /** sessionId -> TUI extension currently streaming it (token-level sync). */\n  externalLive: Record<string, boolean>;",
);
t = t.replace(
  "    externalActive: false,",
  "    externalActive: false,\n    externalLive: {},",
);

// sendMessage guard (single-writer / KV safety)
const guardOld = "    // omp -p needs EOF per turn: steering = queue + auto-send on commit.\n    if (get().isGenerating) {";
const guardNew = [
  "    // KV-CACHE SAFETY: one writer per session. If the TUI extension is",
  "    // mid-turn for this session, refuse the send (fork or wait) instead of",
  "    // spawning a second omp process that would diverge the KV prefix.",
  "    const cur = get().currentSessionId;",
  "    if (cur && get().externalLive[cur]) {",
  "      set((s) => ({",
  "        notices: [",
  "          ...s.notices,",
  "          {",
  "            level: 'warning',",
  "            message:",
  "              'Session is mid-turn in the omp TUI — sends are blocked until it finishes (single-writer rule). Fork it to branch now.',",
  "          },",
  "        ],",
  "      }));",
  "      return;",
  "    }",
  "    // omp -p needs EOF per turn: steering = queue + auto-send on commit.",
  "    if (get().isGenerating) {",
].join("\n");
if (!t.includes(guardOld)) fail("GUARD ANCHOR MISS");
t = t.replace(guardOld, guardNew);

// ext_session + ext_event cases (before case 'sessions')
const caseOld = "        case 'sessions':";
const caseNew = [
  "        case 'ext_session': {",
  "          const sid = msg.sessionId;",
  "          set((s) => ({",
  "            externalLive: sid",
  "              ? { ...s.externalLive, [sid]: msg.active }",
  "              : s.externalLive,",
  "            externalActive:",
  "              msg.active && sid === get().currentSessionId",
  "                ? true",
  "                : s.externalActive,",
  "          }));",
  "          break;",
  "        }",
  "        case 'ext_event': {",
  "          // Token-level mirror of a TUI-run session. Reuse the live pipeline",
  "          // verbatim; commit on agent_end (no 'complete' arrives externally).",
  "          const sid = msg.sessionId;",
  "          if (!sid || sid !== get().currentSessionId) break;",
  "          const ev = msg.event;",
  "          if (ev.type === 'agent_start') {",
  "            set({ isGenerating: true, liveSteps: [], streamingText: '', streamingThinking: '' });",
  "          }",
  "          processEvent(ev, sid);",
  "          if (ev.type === 'agent_end') {",
  "            const { pendingMessages } = get();",
  "            set((s) => ({",
  "              messages: [...s.messages, ...pendingMessages],",
  "              pendingMessages: [],",
  "              liveSteps: [],",
  "              streamingText: '',",
  "              streamingThinking: '',",
  "              isGenerating: false,",
  "            }));",
  "          }",
  "          break;",
  "        }",
  "        case 'sessions':",
].join("\n");
if (!t.includes(caseOld)) fail("CASE ANCHOR MISS");
t = t.replace(caseOld, caseNew);
fs.writeFileSync(p, t);

// ---- ChatScreen banner ----
p = "D:/omp-mobile/mobile/src/screens/ChatScreen.tsx";
t = fs.readFileSync(p, "utf8");
t = t.replace("    externalActive,\n", "    externalActive,\n    externalLive,\n");
t = t.replace(
  "      {externalActive ? (",
  "      {externalActive || externalLive[currentSessionId ?? ''] ? (",
);
t = t.replace(
  "            Live in omp TUI — syncing in real time",
  "            Live in omp TUI — streaming in real time",
);
fs.writeFileSync(p, t);
console.log("client ext pipeline done");

function fail(m) {
  console.log(m);
  process.exit(1);
}
