/*
 * PURPOSE: Zustand store for OMP Mobile — the single source of app state.
 * Three logical slices live in one create() call:
 *   - connection: server URL, token, WS + server status, tunnel
 *   - chat: current session, messages, streaming text, send/cancel/load
 *   - sessions: session list + refresh
 *
 * serverUrl and token are persisted to AsyncStorage and restored via hydrate().
 * The WebSocket service instance is kept in a module-level variable (not in
 * reactive state) so it never triggers re-renders.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebSocketService, type WsStatus } from '../services/ws';
import type {
  OmpEvent,
  OmpMessage,
  ServerStatus,
  SessionSummary,
  WsServerMessage,
} from '../types';

const KEY_URL = 'omp.serverUrl';
const KEY_TOKEN = 'omp.token';

// Module-level holder for the live WebSocket service (kept out of state).
let wsService: WebSocketService | null = null;

interface SendMessageOpts {
  model?: string;
  thinking?: string;
  autoApprove?: boolean;
  cwd?: string;
}

interface StoreState {
  // ── connection slice ────────────────────────────────────────────────────────
  serverUrl: string;
  token: string;
  wsStatus: WsStatus;
  serverStatus: ServerStatus | null;
  tunnelUrl: string | null;
  tunnelStatus: string | null;
  setServerUrl: (url: string) => void;
  setToken: (token: string) => void;
  connect: () => void;
  disconnect: () => void;
  startTunnel: () => void;
  stopTunnel: () => void;

  // ── chat slice ──────────────────────────────────────────────────────────────
  currentSessionId: string | null;
  messages: OmpMessage[];
  streamingText: string;
  isGenerating: boolean;
  currentModel: string | null;
  sendMessage: (content: string, opts?: SendMessageOpts) => void;
  cancelGeneration: () => void;
  loadSession: (sessionId: string) => void;
  startNewSession: () => void;
  /** Single entry point for every WsServerMessage; updates all slices. */
  processWsEvent: (msg: WsServerMessage) => void;

  // ── sessions slice ──────────────────────────────────────────────────────────
  sessions: SessionSummary[];
  loadingSessions: boolean;
  refreshSessions: () => void;

  // ── hydration ───────────────────────────────────────────────────────────────
  hydrate: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => {
  // ─── streaming helpers (close over set/get) ───────────────────────────────

  /** Flush any accumulated streaming text into a finalized assistant message. */
  const flushStream = (): void => {
    const { streamingText, messages } = get();
    if (streamingText) {
      set({
        messages: [
          ...messages,
          { role: 'assistant', content: [{ type: 'text', text: streamingText }] },
        ],
        streamingText: '',
      });
    }
  };

  /** Apply an OMP streaming event to chat state. */
  const processEvent = (event: OmpEvent, sessionId: string): void => {
    switch (event.type) {
      case 'session': {
        // Adopt the server-assigned session id (new or resumed).
        if (sessionId) set({ currentSessionId: sessionId });
        break;
      }
      case 'agent_start': {
        set({ isGenerating: true, streamingText: '' });
        if (event.model) set({ currentModel: event.model });
        break;
      }
      case 'turn_start': {
        // Nothing to surface yet.
        break;
      }
      case 'message_start': {
        if (event.message?.model) set({ currentModel: event.message.model });
        if (event.message?.role === 'assistant') set({ streamingText: '' });
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
        }
        // text_end: nothing to do; message_end finalizes.
        break;
      }
      case 'message_end': {
        const msg = event.message;
        const isAssistant =
          msg?.role === 'assistant' ||
          (msg?.role === undefined && get().streamingText.length > 0);
        if (!isAssistant) break;
        const { streamingText, messages } = get();
        if (streamingText) {
          // Streamed text wins — finalize it with any trailing metadata.
          const finalized: OmpMessage = {
            role: 'assistant',
            content: [{ type: 'text', text: streamingText }],
            model: msg?.model,
            usage: msg?.usage,
            cost: event.cost,
            duration: event.duration,
            ttft: event.ttft,
          };
          set({ messages: [...messages, finalized], streamingText: '' });
        } else if (msg?.content && msg.content.length > 0) {
          const finalized: OmpMessage = {
            role: 'assistant',
            content: msg.content,
            model: msg.model,
            usage: msg.usage,
            cost: event.cost,
            duration: event.duration,
            ttft: event.ttft,
          };
          set((s) => ({ messages: [...s.messages, finalized] }));
        }
        break;
      }
      case 'turn_end': {
        break;
      }
      case 'agent_end': {
        flushStream();
        set({ isGenerating: false });
        break;
      }
      case 'custom': {
        // Reserved for future UI extensions.
        break;
      }
    }
  };

  // ─── store ──────────────────────────────────────────────────────────────────

  return {
    // connection
    serverUrl: '',
    token: '',
    wsStatus: 'disconnected',
    serverStatus: null,
    tunnelUrl: null,
    tunnelStatus: null,

    setServerUrl: (url) => {
      set({ serverUrl: url });
      AsyncStorage.setItem(KEY_URL, url).catch(() => {});
    },

    setToken: (token) => {
      set({ token });
      AsyncStorage.setItem(KEY_TOKEN, token).catch(() => {});
    },

    connect: () => {
      const { serverUrl, token } = get();
      if (!serverUrl) return;

      // Tear down any existing connection before starting a fresh one.
      wsService?.disconnect();
      wsService = new WebSocketService();

      wsService.onMessage = (msg) => get().processWsEvent(msg);
      wsService.onStatusChange = (status) => {
        set({ wsStatus: status });
        if (status === 'connected') {
          // Prime the UI with sessions + server status once connected.
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
    isGenerating: false,
    currentModel: null,

    sendMessage: (content, opts) => {
      if (!wsService) return;
      const state = get();
      const userMessage: OmpMessage = {
        role: 'user',
        content: [{ type: 'text', text: content }],
      };
      set({
        messages: [...state.messages, userMessage],
        isGenerating: true,
        streamingText: '',
        currentModel: opts?.model ?? state.currentModel,
      });
      wsService.send({
        type: 'send',
        content,
        sessionId: state.currentSessionId ?? null,
        model: opts?.model,
        thinking: opts?.thinking,
        autoApprove: opts?.autoApprove,
        cwd: opts?.cwd,
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
        isGenerating: false,
      });
      wsService?.send({ type: 'get_history', sessionId });
    },

    startNewSession: () => {
      set({
        currentSessionId: null,
        messages: [],
        streamingText: '',
        isGenerating: false,
      });
    },

    processWsEvent: (msg) => {
      switch (msg.type) {
        case 'event':
          processEvent(msg.event, msg.sessionId);
          break;
        case 'complete':
          // Generation finished — flush any un-finalized stream, then stop.
          flushStream();
          set({ isGenerating: false });
          break;
        case 'error':
          flushStream();
          set({ isGenerating: false });
          break;
        case 'sessions':
          set({ sessions: msg.sessions, loadingSessions: false });
          break;
        case 'history':
          set({
            currentSessionId: msg.sessionId,
            messages: msg.messages,
            streamingText: '',
            isGenerating: false,
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

    // hydration
    hydrate: async () => {
      try {
        const [url, token] = await Promise.all([
          AsyncStorage.getItem(KEY_URL),
          AsyncStorage.getItem(KEY_TOKEN),
        ]);
        set({ serverUrl: url ?? '', token: token ?? '' });
      } catch {
        // Leave defaults on read failure.
      }
    },
  };
});
