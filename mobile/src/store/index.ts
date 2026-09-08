/*
 * PURPOSE: Zustand store for OMP Mobile — the single source of app state.
 * Handles all OMP event types: text, thinking, tool calls, notices, titles.
 * Includes model selector and thinking level state.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebSocketService, type WsStatus } from '../services/ws';
import type {
  OmpEvent,
  OmpMessage,
  OmpContentBlock,
  ServerStatus,
  SessionSummary,
  WsServerMessage,
  ToolCallInfo,
  ThinkingLevel,
  LiveStep,
} from '../types';

const KEY_URL = 'omp.serverUrl';
const KEY_TOKEN = 'omp.token';
const KEY_MODEL = 'omp.model';
const KEY_THINKING = 'omp.thinking';

const KEY_CWD = 'omp.cwd';
const KEY_RECENT = 'omp.recentModels';
const KEY_FAV = 'omp.favoriteModels';
/** Last open session id — restored after process death / activity recreate. */
const KEY_LAST_SESSION = 'omp.lastSession';

let wsService: WebSocketService | null = null;
/** Resolves the pending forkSession() promise when the server replies 'forked'. */
let forkResolver: ((sessionId: string | null) => void) | null = null;

interface SendMessageOpts {
  model?: string;
  thinking?: string;
  autoApprove?: boolean;
  cwd?: string;
}

interface StoreState {
  // connection
  serverUrl: string;
  token: string;
  wsStatus: WsStatus;
  serverStatus: ServerStatus | null;
  tunnelUrl: string | null;
  tunnelStatus: string | null;
  setToken: (token: string) => void;
  connect: () => void;
  disconnect: () => void;
  startTunnel: () => void;
  stopTunnel: () => void;

  // chat
  currentSessionId: string | null;
  messages: OmpMessage[];
  streamingText: string;
  streamingThinking: string;
  isGenerating: boolean;
  currentModel: string | null;
  selectedModel: string | null;
  thinkingLevel: ThinkingLevel;
  selectedCwd: string | null;
  toolCalls: ToolCallInfo[];
  /** In-flight chain-of-thought steps for the live working group. */
  liveSteps: LiveStep[];
  /** Assistant/toolResult messages buffered until the turn completes. */
  pendingMessages: OmpMessage[];
  notices: { level: string; message: string }[];
  sessionTitle: string | null;
  /** Context tokens used by the latest assistant turn (usage.totalTokens). */
  contextTokens: number;
  setSelectedModel: (model: string) => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setSelectedCwd: (cwd: string) => void;
  sendMessage: (content: string, opts?: SendMessageOpts) => void;
  cancelGeneration: () => void;
  loadSession: (sessionId: string) => void;
  startNewSession: () => void;
  processWsEvent: (msg: WsServerMessage) => void;

  // sessions
  sessions: SessionSummary[];
  loadingSessions: boolean;
  refreshSessions: () => void;
  /** Messages queued while a turn is running (steering, omp TUI style). */
  steerQueue: string[];
  removeSteer: (index: number) => void;
  /** Session id awaiting restore after relaunch (set by restoreOrNew). */
  pendingRestoreId: string | null;
  /** True while the open session is live in another omp instance (TUI). */
  externalActive: boolean;
  /** sessionId -> TUI extension currently streaming it (token-level sync). */
  externalLive: Record<string, boolean>;
  /** Signature of last applied history push (dedupe watcher re-pushes). */
  historySig: string | null;
  /** Transient error toast shown above the composer (guard rejections etc). */
  errorToast: string | null;
  /** Steers acknowledged by the bridge, awaiting TUI boundary delivery. */
  pendingSteers: string[];
  /** sessionId -> agent actively running right now (realtime from ext events). */
  runningSessions: Record<string, boolean>;
  steerModes: ("mid" | "idle")[];
  removePendingSteer: (index: number) => void;
  lastSendContent: string | null;
  /** {shown,total} when the loaded history was capped for mobile. */
  historyTruncated: { shown: number; total: number } | null;
  /** sessionId -> live omp run in progress (server broadcasts). */
  activeSessionIds: Record<string, boolean>;
  /** Re-request server status (model catalog, tunnel, counts) over WS. */
  refreshStatus: () => void;
  refreshCatalog: () => void;
  /** On mount: replay last session if persisted, else start fresh. */
  restoreOrNew: () => void;
  deleteSession: (sessionId: string) => void;
  /** Fork a session up to messageCount messages; resolves with the new session id. */
  forkSession: (sessionId: string, messageCount: number) => Promise<string | null>;
  /** Tool approval mode (reference shield popover). */
  approvalMode: "auto" | "ask" | "readonly";
  setApprovalMode: (mode: "auto" | "ask" | "readonly") => void;
  /** Latest assistant-turn usage for the context popover. */
  lastUsage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
  } | null;
  /** Pending attachment paths shown as chips above the composer. */
  attachments: string[];
  addAttachment: (path: string) => void;
  clearAttachments: () => void;
  renameSession: (sessionId: string, title: string) => void;
  uploadAttachment: (name: string, base64: string) => void;
  /** Recently used model values (most recent first) for the picker strip. */
  recentModels: string[];
  /** Starred model values for the picker's FAVORITES section. */
  favoriteModels: string[];
  toggleFavorite: (model: string) => void;

  // hydration
  hydrate: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => {
  const flushStream = (): void => {
    // Live-turn buffering commits on 'complete'; flush only clears in-flight
    // state (used when switching sessions mid-turn).
    set({ streamingText: '', streamingThinking: '', liveSteps: [], pendingMessages: [] });
  };

  const processEvent = (event: OmpEvent, sessionId: string): void => {
    switch (event.type) {
      case 'session': {
        if (sessionId && sessionId !== get().currentSessionId) {
          set({ currentSessionId: sessionId });
          // Persist so relaunch restores whichever session was live,
          // not only ones opened from the drawer (2026-09-05).
          AsyncStorage.setItem(KEY_LAST_SESSION, sessionId).catch(() => {});
        }
        break;
      }
      case 'agent_start': {
        set({
          isGenerating: true,
          streamingText: '',
          streamingThinking: '',
          toolCalls: [],
          liveSteps: [],
          pendingMessages: [],
          notices: [],
        });
        break;
      }
      case 'turn_start': {
        break;
      }
      case 'message_start': {
        const startMsg = typeof event.message === 'string' ? undefined : event.message;
        if (startMsg?.model) set({ currentModel: startMsg.model });
        if (startMsg?.role === 'assistant') {
          set({ streamingText: '', streamingThinking: '' });
        }
        break;
      }
      case 'message_update': {
        const sub = event.assistantMessageEvent;
        if (!sub) break;
        if (sub.type === 'text_start') {
          set({ streamingText: '' });
        } else if (sub.type === 'text_delta') {
          const delta = sub.delta || sub.text;
          if (typeof delta === 'string') {
            set((s) => ({ streamingText: s.streamingText + delta }));
          }
        } else if (sub.type === 'thinking_start') {
          set((s) => ({
            streamingThinking: '',
            liveSteps: [...s.liveSteps, { kind: 'reasoning', text: '' }],
          }));
        } else if (sub.type === 'thinking_delta') {
          const delta = sub.delta || sub.text;
          if (typeof delta === 'string') {
            set((s) => {
              const steps = s.liveSteps.slice();
              for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i].kind === 'reasoning') {
                  steps[i] = { ...steps[i], text: (steps[i].text || '') + delta };
                  break;
                }
              }
              return { liveSteps: steps, streamingThinking: s.streamingThinking + delta };
            });
          }
        } else if (sub.type === 'tool_call_start' || sub.type === 'toolcall_start') {
          // omp streams toolcall_start with ONLY {contentIndex}; the real
          // id/name arrive with the assistant message_end content blocks
          // (reconciled there by index). Placeholder keeps the row live.
          const idx = typeof sub.contentIndex === 'number' ? sub.contentIndex : -1;
          const id = sub.toolCallId || 'pending-' + idx;
          const name = sub.toolName || 'tool';
          set((s) => ({
            toolCalls: [...s.toolCalls, { id, name, args: '', status: 'running' as const }],
            liveSteps: [...s.liveSteps, {
              kind: 'tool' as const,
              id,
              name,
              args: '',
              status: 'running' as const,
              idx,
            }],
          }));
        } else if (sub.type === 'tool_call_delta' || sub.type === 'toolcall_delta') {
          const delta = sub.delta || sub.args || '';
          const idx = typeof sub.contentIndex === 'number' ? sub.contentIndex : -1;
          if (delta) {
            set((s) => ({
              toolCalls: s.toolCalls.map((tc) =>
                (sub.toolCallId && tc.id === sub.toolCallId) || (idx >= 0 && tc.id === 'pending-' + idx)
                  ? { ...tc, args: tc.args + delta }
                  : tc
              ),
              liveSteps: s.liveSteps.map((st) =>
                (sub.toolCallId && st.id === sub.toolCallId) || (idx >= 0 && st.idx === idx)
                  ? { ...st, args: (st.args || '') + delta }
                  : st
              ),
            }));
          }
        } else if (sub.type === 'tool_call_end' || sub.type === 'toolcall_end') {
          // Args complete; execution starts now. Done-status + result come
          // with the toolResult message — do NOT mark done here.
        }
        break;
      }
      case 'message_end': {
        const msg = typeof event.message === 'string' ? undefined : event.message;
        // Tool results are their own messages; keep them so the trace can pair
        // results to tool_use blocks by toolCallId (live and from history).
        if (msg?.role === 'toolResult') {
          const text = (msg.content || [])
            .map((c) => (c.type === 'text' ? c.text || '' : ''))
            .join('\n')
            .trim();
          set((s) => ({
            pendingMessages: [...s.pendingMessages, msg],
            liveSteps: s.liveSteps.map((st) =>
              st.id === msg.toolCallId
                ? { ...st, result: text || undefined, isError: msg.isError, status: 'done' as const }
                : st
            ),
          }));
          break;
        }
        // Intermediate assistant responses belong INSIDE the worked widget
        // as live text steps (user spec 2026-09-05); the final one becomes
        // the answer below once the turn commits.
        if (msg?.role === 'assistant') {
          const blocks = (msg.content || []) as { type?: string; text?: string }[];
          const txt = blocks
            .filter((b) => b.type === 'text' && b.text && /[\w]/.test(b.text))
            .map((b) => b.text || '')
            .join('\n')
            .trim();
          if (txt) {
            set((s) => ({ liveSteps: [...s.liveSteps, { kind: 'text', text: txt }] })); // live text step
          }
        }
        const isAssistant = msg?.role === 'assistant' ||
          (msg?.role === undefined && (get().streamingText.length > 0 || get().streamingThinking.length > 0));
        if (!isAssistant) break;

        // Reconcile live tool steps: toolcall_start carried only contentIndex;
        // the assistant content blocks now carry the real id/name per index,
        // so placeholder rows get their wrench label + result pairing id.
        if (msg?.content) {
          msg.content.forEach((b, i) => {
            if (b.type !== 'toolCall' && b.type !== 'tool_use') return;
            const realId = b.id || '';
            if (!realId) return;
            set((s) => ({
              liveSteps: s.liveSteps.map((st) =>
                st.kind === 'tool' && st.idx === i
                  ? { ...st, id: realId, name: b.name || st.name || 'tool' }
                  : st
              ),
              toolCalls: s.toolCalls.map((tc) =>
                tc.id === 'pending-' + i
                  ? { ...tc, id: realId, name: b.name || tc.name }
                  : tc
              ),
            }));
          });
        }

        // Context indicator: latest usage.totalTokens from the assistant turn.
        const usage = msg?.usage;
        if (usage && typeof usage === "object" && "totalTokens" in usage && typeof usage.totalTokens === "number") {
          set({ contextTokens: usage.totalTokens });
          const u = usage as {
            input?: number;
            output?: number;
            cacheRead?: number;
            cacheWrite?: number;
            totalTokens?: number;
          };
          set({
            lastUsage: {
              input: u.input ?? 0,
              output: u.output ?? 0,
              cacheRead: u.cacheRead ?? 0,
              cacheWrite: u.cacheWrite ?? 0,
              totalTokens: u.totalTokens ?? 0,
            },
          });
        }

        const { streamingText, streamingThinking, messages, currentModel } = get();
        // Buffer the assistant message; the whole turn commits on 'complete'
        // so the live working group stays one smooth unit while interleaving.
        set((s) => ({
          pendingMessages: msg ? [...s.pendingMessages, msg] : s.pendingMessages,
          streamingText: '',
          streamingThinking: '',
        }));
        break;
      }
      case 'turn_end': {
        break;
      }
      case 'agent_end': {
        // 'complete' follows; commit here too so a missing complete still lands.
        const { pendingMessages } = get();
        if (pendingMessages.length > 0) {
          set((s) => ({
            messages: [...s.messages, ...pendingMessages],
            pendingMessages: [],
            liveSteps: [],
            streamingText: '',
            streamingThinking: '',
            isGenerating: false,
          }));
          // Steering: auto-send the next queued message once idle.
          const next = get().steerQueue[0];
          if (next) {
            set((s) => ({ steerQueue: s.steerQueue.slice(1) }));
            setTimeout(() => get().sendMessage(next), 50);
          }
        }
        break;
      }
      case 'custom': {
        const ct = event.customType || (event.data && (event.data as Record<string, unknown>).customType) || '';
        if (ct === 'tool_execution_start') {
          const data = event.data as Record<string, unknown> | undefined;
          if (data?.toolCallId && data?.toolName) {
            set((s) => ({
              toolCalls: [...s.toolCalls, {
                id: String(data.toolCallId),
                name: String(data.toolName),
                args: '',
                status: 'running' as const,
              }],
            }));
          }
        } else if (ct === 'tool_execution_end') {
          const data = event.data as Record<string, unknown> | undefined;
          if (data?.toolCallId) {
            set((s) => ({
              toolCalls: s.toolCalls.map((tc) =>
                tc.id === String(data.toolCallId) ? { ...tc, status: 'done' as const } : tc
              ),
            }));
          }
        }
        break;
      }
      case 'notice': {
        const noticeText = typeof event.message === 'string' ? event.message : '';
        if (event.level && noticeText) {
          // Skip advisor noise
          if (!noticeText.includes('Advisor')) {
            set((s) => ({
              notices: [...s.notices, { level: event.level!, message: noticeText }],
            }));
          }
        }
        break;
      }
      case 'title':
      case 'title_change': {
        if (event.title) set({ sessionTitle: event.title });
        break;
      }
      case 'thinking_level_change': {
        if (event.thinkingLevel) set({ thinkingLevel: event.thinkingLevel as ThinkingLevel });
        break;
      }
      default: {
        // Silently ignore unknown event types (advisor_cost_changed, service_tier_change, etc.)
        break;
      }
    }
  };

  return {
    // connection
    serverUrl: '',
    token: '',
    wsStatus: 'disconnected',
    serverStatus: null,
    pendingRestoreId: null,
    steerQueue: [],
    externalActive: false,
    externalLive: {},
    historySig: null,
    errorToast: null,
    pendingSteers: [],
    runningSessions: {},
    steerModes: [],
    lastSendContent: null,
    historyTruncated: null,
    activeSessionIds: {},
    tunnelUrl: null,
    tunnelStatus: null,

    setToken: (token) => {
      set({ token });
      AsyncStorage.setItem(KEY_TOKEN, token).catch(() => {});
    },
    connect: () => {
      const { serverUrl, token } = get();
      if (!serverUrl) return;
      wsService?.disconnect();
      wsService = new WebSocketService();
      wsService.onMessage = (msg) => get().processWsEvent(msg);
      wsService.onStatusChange = (status) => {
        set({ wsStatus: status });
        if (status === "connected") {
          if (rebootstrapTimer) {
            clearTimeout(rebootstrapTimer);
            rebootstrapTimer = null;
          }
        } else if (status === "disconnected" && !rebootstrapTimer) {
          rebootstrapTimer = setTimeout(() => {
            rebootstrapTimer = null;
            if (get().wsStatus !== "connected") void bootstrapConnect(0);
          }, 3000);
        }
        if (status === 'connected') {
          // Bridge truth is per-connection: ext hellos re-register within
          // seconds, but dead TUIs never send ext_bye/agent_end — without a
          // reset their pips (externalLive/runningSessions) stick forever.
          set({ externalLive: {}, externalActive: false, runningSessions: {} });
          get().refreshSessions();
          wsService?.send({ type: 'get_status' });
          // Restore the session open before process death / recreation.
          // Re-request history for the open session: a get_history sent while
          // the socket was still connecting is dropped and the watcher never
          // registers for that session (2026-09-06 re-request history on connect).
          const openSid = get().currentSessionId;
          if (openSid) wsService?.send({ type: "get_history", sessionId: openSid });
          const rid = get().pendingRestoreId;
          if (rid && !get().currentSessionId) {
            set({ pendingRestoreId: null });
            console.log("[restore] sending get_history", rid);
            wsService?.send({ type: 'get_history', sessionId: rid });
          }
        }
      };
      wsService.connect(serverUrl, token);
    },
    disconnect: () => {
      wsService?.disconnect();
      wsService = null;
      set({ wsStatus: 'disconnected' });
    },
    startTunnel: () => {
      wsService?.send({ type: 'start_tunnel' });
      set({ tunnelStatus: 'starting' });
    },
    stopTunnel: () => {
      wsService?.send({ type: 'stop_tunnel' });
    },

    // chat
    currentSessionId: null,
    messages: [],
    streamingText: '',
    streamingThinking: '',
    isGenerating: false,
    currentModel: null,
    selectedModel: null,
    thinkingLevel: 'high' as ThinkingLevel,
    selectedCwd: null,
    toolCalls: [],
    liveSteps: [],
    pendingMessages: [],
    notices: [],
    sessionTitle: null,
    contextTokens: 0,

    setSelectedModel: (model) => {
      set((s) => ({
        selectedModel: model,
        recentModels: [model, ...s.recentModels.filter((m) => m !== model)].slice(0, 5),
      }));
      AsyncStorage.setItem(KEY_RECENT, JSON.stringify([model, ...get().recentModels.filter((m) => m !== model)].slice(0, 5))).catch(() => {});
      AsyncStorage.setItem(KEY_MODEL, model).catch(() => {});
    },
    setThinkingLevel: (level) => {
      set({ thinkingLevel: level });
      AsyncStorage.setItem(KEY_THINKING, level).catch(() => {});
    },

    toggleFavorite: (model) => {
      const next = get().favoriteModels.includes(model)
        ? get().favoriteModels.filter((m) => m !== model)
        : [model, ...get().favoriteModels];
      set({ favoriteModels: next });
      AsyncStorage.setItem(KEY_FAV, JSON.stringify(next)).catch(() => {});
    },

    setSelectedCwd: (cwd) => {
      set({ selectedCwd: cwd });
      AsyncStorage.setItem(KEY_CWD, cwd).catch(() => {});
    },

    sendMessage: (content, opts) => {
    // KV-CACHE SAFETY: one writer per session. If the TUI extension is
    // mid-turn for this session, refuse the send (fork or wait) instead of
    // spawning a second omp process that would diverge the KV prefix.
    // TUI-owned sessions: the bridge routes this send into the running TUI
    // turn as steering (pi.sendUserMessage deliverAs:'steer') — same UX as
    // typing in the TUI while it answers. No second process, no KV divergence.
    // omp -p needs EOF per turn: steering = queue + auto-send on commit.
    if (get().isGenerating) {
      set((s) => ({ steerQueue: [...s.steerQueue, content] }));
      return;
    }
      if (!wsService) return;
      const state = get();
      const model = opts?.model ?? state.selectedModel ?? state.currentModel ?? undefined;
      const thinking = opts?.thinking ?? state.thinkingLevel ?? undefined;
      const userMessage: OmpMessage = {
        role: 'user',
        content: [{ type: 'text', text: content }],
      };
      set({
        messages: [...state.messages, userMessage],
        isGenerating: true,
        streamingText: '',
        streamingThinking: '',
        toolCalls: [],
        notices: [],
        currentModel: model ?? state.currentModel,
      });
      set({ lastSendContent: content });
      // own-run active marker so the drawer shows the live dot + top sort
      const sid0 = state.currentSessionId;
      if (sid0) {
        set((s) => ({ activeSessionIds: { ...s.activeSessionIds, [sid0]: true } }));
      }
      wsService.send({
        type: 'send',
        content,
        sessionId: state.currentSessionId ?? null,
        model,
        thinking,
        // omp -p is non-interactive: without --auto-approve every tool call
        // (MCP included) is denied. The access-mode UI was removed, so always
        // auto-approve (2026-09-05: "mcp tool blocked" regression).
        autoApprove: opts?.autoApprove ?? true,
        cwd: opts?.cwd ?? state.selectedCwd ?? undefined,
      });
    },

    cancelGeneration: () => {
      wsService?.send({ type: 'cancel' });
      flushStream();
      set({ isGenerating: false });
    },

    loadSession: (sessionId) => {
      set({
        currentSessionId: sessionId,
        // Reset the dedupe sig: otherwise the history push for a re-opened
        // session matches the stale sig and gets skipped -> empty list
        // (2026-09-05 blank-load root cause).
        historySig: null,
        externalActive: false,
        historyTruncated: null,
        messages: [],
        streamingText: '',
        streamingThinking: '',
        isGenerating: false,
        toolCalls: [],
        notices: [],
        sessionTitle: null,
      });
      AsyncStorage.setItem(KEY_LAST_SESSION, sessionId).catch(() => {});
      wsService?.send({ type: 'get_history', sessionId });
    },

    startNewSession: () => {
      AsyncStorage.removeItem(KEY_LAST_SESSION).catch(() => {});
      set({
        pendingRestoreId: null,
        historySig: null,
        externalActive: false,
        historyTruncated: null,
        currentSessionId: null,
        messages: [],
        streamingText: '',
        streamingThinking: '',
        isGenerating: false,
        toolCalls: [],
        notices: [],
        sessionTitle: null,
      });
    },

    processWsEvent: (msg) => {
      switch (msg.type) {
        case 'event':
          processEvent(msg.event, msg.sessionId);
          break;
        case 'complete':
        case 'error': {
          const { pendingMessages } = get();
          const errText = msg.type === 'error' ? msg.message || '' : '';
          // Guard rejection (single-writer): remove the optimistic user bubble
          // so no phantom turn lingers, and toast the reason above composer.
          const isGuard = /single writer|KV-cache/i.test(errText);
          const msgs = get().messages;
          const lastM = msgs[msgs.length - 1];
          const popped =
            isGuard &&
            !!lastM &&
            lastM.role === 'user' &&
            JSON.stringify(lastM.content || []).includes(get().lastSendContent || '\u0000');
          if (errText) {
            set({ errorToast: errText });
            setTimeout(() => {
              if (get().errorToast === errText) set({ errorToast: null });
            }, 5000);
          }
          const doneSid = get().currentSessionId;
          set((s) => {
            const nextActive = { ...s.activeSessionIds };
            if (doneSid) delete nextActive[doneSid];
            return {
              activeSessionIds: nextActive,
              messages: popped ? msgs.slice(0, -1) : [...s.messages, ...pendingMessages],
              pendingMessages: [],
              liveSteps: [],
              streamingText: '',
              streamingThinking: '',
              isGenerating: false,
            };
          });
          // Steering: auto-send the next queued message once idle.
          const next = get().steerQueue[0];
          if (next) {
            set((s) => ({ steerQueue: s.steerQueue.slice(1) }));
            setTimeout(() => get().sendMessage(next), 50);
          }
          break;
        }
        case 'steered': {
          // Bridge routed our send into the TUI turn as steering; it will
          // echo back as a user message via ext events. Ack above composer.
          const txt = (get().lastSendContent || '').trim();
          if (txt) set((s) => ({ pendingSteers: [...s.pendingSteers, txt] }));
          set({ errorToast: 'Steering queued - the TUI picks it up at its next turn boundary.' });
          setTimeout(() => set({ errorToast: null }), 4000);
          // Chip stays until the TUI confirms delivery (ext agent_start);
          // no timeout - a timed-out chip would read as lost while the steer
          // still lands at a later boundary (2026-09-05 advisory).
          break;
        }
        case 'ext_entry': {
          // Realtime interception: every persisted TUI entry. Entry payload
          // drives live model/context state; everything else triggers a
          // guarded debounced history refresh.
          const esid = msg.sessionId;
          const entry = msg.entry as Record<string, unknown> | undefined;
          if (!esid) break;
          if (entry) {
            const et = entry.type as string | undefined;
            if (et === 'model_change') {
              // model_change.model is a plain "provider/model" string.
              const mm = entry.model;
              if (typeof mm === 'string' && mm) set({ currentModel: mm });
              break;
            }
            if (et === 'model_usage' && esid === get().currentSessionId) {
              // Usage rides on the live-only model_usage entry (verified shape
              // 2026-09-08: entry.usage {input,output,cacheRead,cacheWrite,
              // totalTokens,...}; message entries carry NO usage). Max-guard:
              // tiny auto-thinking sub-requests must not clobber the session
              // total. model comes from model_change only (this entry's model
              // is the sub-request's, e.g. a tiny thinker).
              const u = entry.usage as Record<string, unknown> | undefined;
              const total = typeof u?.totalTokens === 'number' ? u.totalTokens : 0;
              if (total > 0 && total >= get().contextTokens) {
                set({
                  contextTokens: total,
                  lastUsage: {
                    input: Number(u?.input ?? 0),
                    output: Number(u?.output ?? 0),
                    cacheRead: Number(u?.cacheRead ?? 0),
                    cacheWrite: Number(u?.cacheWrite ?? 0),
                    totalTokens: total,
                  },
                });
              }
              break;
            }
          }
          if (esid === get().currentSessionId && !get().isGenerating) {
            // Idle only: a mid-turn history push would clear streamingText/
            // liveSteps and flip steer semantics. The live mirror commits the
            // turn on agent_end; refresh lands right after.
            setTimeout(() => {
              if (get().currentSessionId === esid) wsService?.send({ type: "get_history", sessionId: esid });
            }, 250);
          }
          break;
        }
        case 'ext_steer_ack': {
          set((s) => ({ steerModes: [...s.steerModes, msg.mode] }));
          break;
        }
        case 'ext_session': {
          const sid = msg.sessionId;
          const running =
            (msg as unknown as Record<string, unknown>).running === true;
          const runningKnown =
            typeof (msg as unknown as Record<string, unknown>).running === 'boolean';
          set((s) => ({
            externalLive: sid
              ? { ...s.externalLive, [sid]: msg.active }
              : s.externalLive,
            // running recovers the Stop button for a turn whose agent_start
            // fired before we opened/connected (reconnect + mid-turn open).
            runningSessions:
              sid && runningKnown
                ? { ...s.runningSessions, [sid]: running }
                : s.runningSessions,
          }));
          if (sid && sid === get().currentSessionId) set({ externalActive: msg.active });
          // A running ext_session for the OPEN session recovers the live
          // footer + Stop button when agent_start fired before we connected.
          // Never force false here — turn end is the ext_event's job.
          if (sid && sid === get().currentSessionId && running && !get().isGenerating) {
            set({
              isGenerating: true,
              liveSteps: [],
              streamingText: '',
              streamingThinking: '',
            });
          }
          break;
        }
        case 'ext_event': {
          // Token-level mirror of a TUI-run session. Reuse the live pipeline
          // verbatim; commit on agent_end (no 'complete' arrives externally).
          const sid = msg.sessionId;
          const ev = msg.event;
          // Boundary-only ingress log (per-delta here is ~15 lines/s of spam).
          if (ev && (ev.type === 'agent_start' || ev.type === 'agent_end' || ev.type === 'message_start' || ev.type === 'message_end')) {
            console.log('[ext] evt', ev.type, (sid || '').slice(0, 8), 'cur=', (get().currentSessionId || '').slice(0, 8));
          }
          // Pips update for ALL sessions (drawer) before the open-session filter.
          if (sid && ev) {
            if (ev.type === 'agent_start') {
              set((s) => ({ runningSessions: { ...s.runningSessions, [sid]: true } }));
            } else if (ev.type === 'agent_end') {
              set((s) => ({ runningSessions: { ...s.runningSessions, [sid]: false } }));
            }
          }
          if (!sid || sid !== get().currentSessionId) break;
          if (ev.type === 'agent_start') {
            set((s) => {
              // idle-queued steers deliver at this boundary; mid steers that
              // missed their user-echo also clear here as a fallback.
              const drop = s.steerModes[0] !== undefined ? 1 : 0;
              return {
                isGenerating: true,
                liveSteps: [],
                streamingText: '',
                streamingThinking: '',
                pendingSteers: s.pendingSteers.slice(drop),
                steerModes: s.steerModes.slice(drop),
              };
            });
          }
          if (ev.type === 'message_start' && ev.message && (ev.message as { role?: string }).role === 'user') {
            set((s) => {
              if (s.steerModes[0] !== 'mid') return s;
              return { pendingSteers: s.pendingSteers.slice(1), steerModes: s.steerModes.slice(1) };
            });
          }
          processEvent(ev, sid);
          if (ev.type === 'agent_end') {
            const { pendingMessages } = get();
            set((s) => ({
              messages: [...s.messages, ...pendingMessages],
              pendingMessages: [],
              liveSteps: [],
              streamingText: '',
              streamingThinking: '',
              isGenerating: false,
            }));
          }
          break;
        }
        case 'sessions':
          set({ sessions: msg.sessions, loadingSessions: false });
          break;
        case 'forked': {
          set({ sessions: msg.sessions });
          const r = forkResolver;
          forkResolver = null;
          if (r) r(msg.sessionId);
          break;
        }
        case 'deleted':
        case 'renamed':
          set({ sessions: msg.sessions, loadingSessions: false });
          break;
        case 'session_active':
          set((s) => {
            const next = { ...s.activeSessionIds };
            if (msg.active) next[msg.sessionId] = true;
            else delete next[msg.sessionId];
            return { activeSessionIds: next };
          });
          break;
        case 'uploaded':
          set((s) => ({ attachments: [...s.attachments, msg.path] }));
          break;
        case 'history': {
          // Dedupe identical re-pushes (watcher + restore racing): each one
          // re-rendered the whole list and caused the session-load flash.
          const hm = msg.messages || [];
          const lastM = hm[hm.length - 1] as { role?: string; content?: unknown[] } | undefined;
          const sig = msg.sessionId + ':' + hm.length + ':' + (lastM?.role || '') + ':' + (lastM?.content || []).length;
          console.log('[hist] recv', msg.sessionId.slice(0,8), hm.length, 'sig=', sig.slice(0,24), 'prev=', (get().historySig || '').slice(0,24));
          if (sig === get().historySig && get().currentSessionId === msg.sessionId) {
            console.log('[hist] SKIP dedupe');
            if (msg.externallyActive) set({ externalActive: true });
            break;
          }
          // Preselect the model omp actually ran this session with, so the
          // picker check + composer chip match reality (2026-09-05).
          let activeModel: string | null = null;
          for (let i = msg.messages.length - 1; i >= 0; i--) {
            const m = msg.messages[i];
            if (m.role === 'assistant' && m.model) { activeModel = m.model; break; }
          }
          set({
            currentSessionId: msg.sessionId,
            historySig: sig,
            externalActive: !!msg.externallyActive,
            historyTruncated: msg.truncated
              ? { shown: (msg.messages || []).length, total: msg.totalCount || 0 }
              : null,
            sessionTitle: msg.title || null,
            ...(activeModel ? { selectedModel: activeModel } : {}),
            // Mid-turn history contains no in-flight assistant text (entries
            // persist at message_end; the live turn commits via pendingMessages
            // at agent_end), so messages are always safe to apply. Guard ONLY
            // the streaming resets: a watcher push landing mid-turn must not
            // nuke the streaming footer (same race class as ext_entry).
            // Mid-turn open coverage: agent_start fired before we opened this
            // session, so recover isGenerating from the realtime running map.
            messages: msg.messages,
            ...(get().isGenerating && get().currentSessionId === msg.sessionId
              ? {}
              : {
                  streamingText: '',
                  streamingThinking: '',
                  isGenerating: !!get().runningSessions[msg.sessionId],
                }),
          });
          console.log('[hist] APPLIED', msg.messages.length);
          if (activeModel) AsyncStorage.setItem(KEY_MODEL, activeModel).catch(() => {});
          break;
        }
        case 'status':
          set({
            serverStatus: msg.status,
            tunnelUrl: msg.status.tunnelUrl,
            tunnelStatus: msg.status.tunnelStatus,
          });
          break;
        case 'tunnel':
          set({ tunnelUrl: msg.url, tunnelStatus: msg.status });
          break;
      }
    },

    // sessions
    sessions: [],
    loadingSessions: false,
    refreshSessions: () => {
      set({ loadingSessions: true });
      wsService?.send({ type: 'list_sessions' });
    },

    removePendingSteer: (index) => {
      set((s) => ({ pendingSteers: s.pendingSteers.filter((_, i) => i !== index) }));
    },

    removeSteer: (index) => {
      set((s) => ({ steerQueue: s.steerQueue.filter((_, i) => i !== index) }));
    },

    refreshStatus: () => {
      wsService?.send({ type: 'get_status' });
    },

    /** Force the server to re-run `omp models ls` (slow); replies with status. */
    refreshCatalog: () => {
      wsService?.send({ type: 'refresh_models' });
    },

    restoreOrNew: () => {
      // Child effects run BEFORE App's bootstrap effect, so the restore
      // decision must live here, not in connect() (2026-09-05 race fix #2).
      AsyncStorage.getItem(KEY_LAST_SESSION)
        .then((last) => {
          if (!last) {
            get().startNewSession();
            return;
          }
          if (get().wsStatus === 'connected') {
            get().loadSession(last);
          } else {
            set({ pendingRestoreId: last });
          }
        })
        .catch(() => get().startNewSession());
    },

    deleteSession: (sessionId) => {
      wsService?.send({ type: 'delete_session', sessionId });
    },

    forkSession: (sessionId, messageCount) =>
      new Promise<string | null>((resolve) => {
        forkResolver = resolve;
        wsService?.send({ type: 'fork_session', sessionId, messageCount });
        setTimeout(() => {
          if (forkResolver === resolve) {
            forkResolver = null;
            resolve(null);
          }
        }, 15000);
      }),

    // hydration
    hydrate: async () => {
      try {
        const [token, model, thinking, cwd] = await Promise.all([
          AsyncStorage.getItem(KEY_TOKEN),
          AsyncStorage.getItem(KEY_MODEL),
          AsyncStorage.getItem(KEY_THINKING),
          AsyncStorage.getItem(KEY_CWD),
        ]);
        let recents: string[] = [];
        try {
          const raw = await AsyncStorage.getItem(KEY_RECENT);
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) recents = parsed.filter((x): x is string => typeof x === "string");
          }
        } catch {
          recents = [];
        }
        let favs: string[] = [];
        try {
          const raw = await AsyncStorage.getItem(KEY_FAV);
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) favs = parsed.filter((x): x is string => typeof x === "string");
          }
        } catch {
          favs = [];
        }
        set({
          token: token ?? 'omp-mobile-personal-2026',
          selectedModel: model ?? null,
          thinkingLevel: (thinking as ThinkingLevel) ?? 'high',
          selectedCwd: cwd ?? null,
          recentModels: recents,
          favoriteModels: favs,
        });
      } catch {
        set({ token: 'omp-mobile-personal-2026' });
      }
      // Auto-connect via the persistent tunnel pointer (no manual URL entry).
      void bootstrapConnect(0);
    },

    approvalMode: "ask",
    setApprovalMode: (mode) => set({ approvalMode: mode }),
    lastUsage: null,
    attachments: [],
    addAttachment: (path) => set((s) => ({ attachments: [...s.attachments, path] })),
    clearAttachments: () => set({ attachments: [] }),
    renameSession: (sessionId, title) => {
      wsService?.send({ type: "rename_session", sessionId, title });
    },

    uploadAttachment: (name, base64) => {
      wsService?.send({ type: "upload", name, data: base64, cwd: get().selectedCwd ?? undefined });
    },

    recentModels: [],
    favoriteModels: [],
  };
});

/** Fixed public pointer that always holds the current Cloudflare tunnel URL. */
const BOOTSTRAP_URL =
  'https://gist.githubusercontent.com/itzrnvr/b5167afad091916fc99263f1e45c7519/raw/omp-tunnel.json';
const MAX_BOOTSTRAP_TRIES = 30;
// Self-heal: bridge restarts rotate the tunnel URL; a running app holding the
// dead URL would never reconnect (the "still no sync" device symptom).
// On disconnect, re-fetch the bootstrap gist and reconnect (2026-09-06).
let rebootstrapTimer: ReturnType<typeof setTimeout> | null = null;

/** Fetch the tunnel URL from the bootstrap gist and connect; retry while the tunnel spins up. */
async function bootstrapConnect(attempt: number): Promise<void> {
  try {
    // Cache-buster: gist raw CDN serves stale copies for minutes despite
    // no-store (phone bootstrapped a pre-lanUrl gist and stuck to tunnel).
    const res = await fetch(BOOTSTRAP_URL + '?t=' + Date.now(), { cache: 'no-store' });
    const data: unknown = await res.json();
    let url: string | null = null;
    if (data && typeof data === 'object' && 'url' in data && typeof data.url === 'string') {
      url = data.url;
    }
    let lanUrl: string | null = null;
    if (data && typeof data === 'object' && 'lanUrl' in data && typeof data.lanUrl === 'string') {
      lanUrl = data.lanUrl;
    }
    let lanUrls: string[] = [];
    if (data && typeof data === 'object' && 'lanUrls' in data && Array.isArray(data.lanUrls)) {
      lanUrls = data.lanUrls.filter((u): u is string => typeof u === 'string');
    }
    // Prefer direct LAN when the phone shares the PC's WiFi: the Cloudflare
    // tunnel adds a full WAN round trip to every streaming frame. Probe with
    // a short timeout; any HTTP response (even 401/404) proves reachability.
    // Probe every published LAN URL: interfaces come and go (WiFi drops, USB
    // re-enumerates on a new subnet) and a stale single URL silently degrades
    // to tunnel. lanUrl kept for older gist formats.
    // Dedupe (lanUrl is usually already inside lanUrls) and probe in
    // PARALLEL: serial 1.5s timeouts over 4-5 unreachable candidates stall
    // cold start by ~7s. Worst case stays 1.5s; first reachable wins, with
    // LAN preferred over tunnel on ties by candidate order.
    const seen = new Set<string>();
    const candidates: string[] = [];
    for (const u of [...lanUrls, lanUrl, url]) {
      if (typeof u === 'string' && u.startsWith('http') && !seen.has(u)) {
        seen.add(u);
        candidates.push(u);
      }
    }
    const probeOne = async (base: string): Promise<string | null> => {
      try {
        const probe = fetch(base + '/api/sync-status', { cache: 'no-store' });
        const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('lan-timeout')), 1500));
        const r = (await Promise.race([probe, timeout])) as { status?: number };
        if (r && typeof r.status === 'number' && r.status < 500) return base;
      } catch {
        // unreachable.
      }
      return null;
    };
    const settled = await Promise.all(candidates.map((c) => probeOne(c)));
    for (let i = 0; i < candidates.length; i++) {
      const base = candidates[i];
      if (settled[i]) {
        console.log('[bootstrap] base', base, base === url ? '(tunnel)' : '(lan)');
        useStore.setState({ serverUrl: base });
        useStore.getState().connect();
        return;
      }
    }
  } catch {
    // Gist unreachable — retry below.
  }
  if (attempt < MAX_BOOTSTRAP_TRIES) {
    setTimeout(() => void bootstrapConnect(attempt + 1), 8000);
  }
}
