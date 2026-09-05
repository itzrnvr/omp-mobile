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
  /** Re-request server status (model catalog, tunnel, counts) over WS. */
  refreshStatus: () => void;
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
        if (sessionId) set({ currentSessionId: sessionId });
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
        if (status === 'connected') {
          get().refreshSessions();
          wsService?.send({ type: 'get_status' });
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

    setSelectedCwd: (cwd) => {
      set({ selectedCwd: cwd });
      AsyncStorage.setItem(KEY_CWD, cwd).catch(() => {});
    },

    sendMessage: (content, opts) => {
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
        messages: [],
        streamingText: '',
        streamingThinking: '',
        isGenerating: false,
        toolCalls: [],
        notices: [],
        sessionTitle: null,
      });
      wsService?.send({ type: 'get_history', sessionId });
    },

    startNewSession: () => {
      set({
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
        case 'complete':
        case 'error': {
          const { pendingMessages } = get();
          set((s) => ({
            messages: [...s.messages, ...pendingMessages],
            pendingMessages: [],
            liveSteps: [],
            streamingText: '',
            streamingThinking: '',
            isGenerating: false,
          }));
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
        case 'uploaded':
          set((s) => ({ attachments: [...s.attachments, msg.path] }));
          break;
        case 'history':
          set({
            currentSessionId: msg.sessionId,
            messages: msg.messages,
            streamingText: '',
            streamingThinking: '',
            isGenerating: false,
            sessionTitle: msg.title || null,
          });
          break;
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

    refreshStatus: () => {
      wsService?.send({ type: 'get_status' });
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
        set({
          token: token ?? 'omp-mobile-personal-2026',
          selectedModel: model ?? null,
          thinkingLevel: (thinking as ThinkingLevel) ?? 'high',
          selectedCwd: cwd ?? null,
          recentModels: recents,
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
  };
});

/** Fixed public pointer that always holds the current Cloudflare tunnel URL. */
const BOOTSTRAP_URL =
  'https://gist.githubusercontent.com/itzrnvr/b5167afad091916fc99263f1e45c7519/raw/omp-tunnel.json';
const MAX_BOOTSTRAP_TRIES = 30;

/** Fetch the tunnel URL from the bootstrap gist and connect; retry while the tunnel spins up. */
async function bootstrapConnect(attempt: number): Promise<void> {
  try {
    const res = await fetch(BOOTSTRAP_URL, { cache: 'no-store' });
    const data: unknown = await res.json();
    let url: string | null = null;
    if (data && typeof data === 'object' && 'url' in data && typeof data.url === 'string') {
      url = data.url;
    }
    if (url && url.startsWith('http')) {
      useStore.setState({ serverUrl: url });
      useStore.getState().connect();
      return;
    }
  } catch {
    // Gist unreachable — retry below.
  }
  if (attempt < MAX_BOOTSTRAP_TRIES) {
    setTimeout(() => void bootstrapConnect(attempt + 1), 8000);
  }
}
