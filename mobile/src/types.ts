/*
 * PURPOSE: Shared TypeScript types for the OMP bridge WebSocket protocol.
 * Covers OMP streaming events, chat messages, session summaries, server
 * status, and the client/server WebSocket message envelopes.
 */

// ─── Content blocks & messages ────────────────────────────────────────────────

export type OmpContentBlockType = 'text' | 'thinking' | 'tool_use' | 'tool_result';

export interface OmpContentBlock {
  type: OmpContentBlockType;
  text?: string;
  thinking?: string;
  thinkingSignature?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  content?: unknown;
  /** tool_use block fields (JSONL shape). */
  id?: string;
  name?: string;
  arguments?: unknown;
}

export type OmpMessageRole = 'user' | 'assistant' | 'system' | 'toolResult' | 'developer';

export interface OmpMessage {
  role: OmpMessageRole;
  content: OmpContentBlock[];
  model?: string;
  usage?: unknown;
  cost?: number;
  duration?: number;
  ttft?: number;
  /** toolResult message fields (JSONL shape). */
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

// ─── Session summary ──────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  title: string;
  timestamp: string;
  cwd?: string;
  messageCount: number;
  size: number;
}

export interface ServerStatus {
  ompVersion: string;
  uptime: number;
  tunnelUrl: string | null;
  tunnelStatus: string;
  activeSessions: number;
  totalSessions: number;
  models: string[];
}

// ─── OMP streaming events ───────────────────────────────────────────────────────

export type OmpEventType =
  | 'session'
  | 'agent_start'
  | 'turn_start'
  | 'message_start'
  | 'message_update'
  | 'message_end'
  | 'turn_end'
  | 'agent_end'
  | 'custom'
  | 'notice'
  | 'advisor_cost_changed'
  | 'title'
  | 'title_change'
  | 'thinking_level_change'
  | 'service_tier_change';

export type AssistantMessageEventType =
  | 'text_start' | 'text_delta' | 'text_end'
  | 'thinking_start' | 'thinking_delta' | 'thinking_end'
  | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end';

export interface AssistantMessageEvent {
  type: AssistantMessageEventType;
  text?: string;
  delta?: string;
  contentIndex?: number;
  content?: string;
  toolCallId?: string;
  toolName?: string;
  args?: string;
}

export interface OmpEvent {
  type: OmpEventType;
  sessionId?: string;
  /** OmpMessage for message_start/end/turn_end; string for notice events. */
  message?: OmpMessage | string;
  role?: OmpMessageRole;
  model?: string;
  content?: OmpContentBlock[];
  assistantMessageEvent?: AssistantMessageEvent;
  usage?: unknown;
  cost?: number;
  duration?: number;
  ttft?: number;
  data?: unknown;
  // notice events
  level?: string;
  // custom events
  customType?: string;
  // title events
  title?: string;
  // thinking level
  thinkingLevel?: string;
}

// ─── Tool call tracking ──────────────────────────────────────────────────────

export interface ToolCallInfo {
  id: string;
  name: string;
  args: string;
  result?: string;
  status: 'running' | 'done' | 'error';
}

// ─── WebSocket protocol envelopes ──────────────────────────────────────────────

export type WsClientCommand =
  | {
      type: 'send';
      content: string;
      sessionId?: string | null;
      model?: string;
      thinking?: string;
      autoApprove?: boolean;
      approvalMode?: 'auto' | 'ask' | 'readonly';
      cwd?: string;
    }
  | { type: 'list_sessions' }
  | { type: 'get_history'; sessionId: string }
  | { type: 'get_status' }
  | { type: 'fork_session'; sessionId: string; messageCount: number }
  | { type: 'delete_session'; sessionId: string }
  | { type: 'rename_session'; sessionId: string; title: string }
  | { type: 'upload'; name: string; data: string; cwd?: string }
  | { type: 'cancel' }
  | { type: 'start_tunnel' }
  | { type: 'stop_tunnel' };

export type WsServerMessage =
  | { type: 'event'; sessionId: string; event: OmpEvent }
  | { type: 'complete'; sessionId: string }
  | { type: 'error'; message: string; sessionId?: string }
  | { type: 'sessions'; sessions: SessionSummary[] }
  | { type: 'history'; sessionId: string; messages: OmpMessage[]; title?: string }
  | { type: 'status'; status: ServerStatus }
  | { type: 'tunnel'; url: string | null; status: string }
  | { type: 'forked'; sessionId: string; sessions: SessionSummary[] }
  | { type: 'deleted'; sessionId: string; sessions: SessionSummary[] }
  | { type: 'renamed'; sessionId: string; sessions: SessionSummary[] }
  | { type: 'uploaded'; path: string };

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

// ─── Model presets ───────────────────────────────────────────────────────────

export interface ModelPreset {
  label: string;
  value: string;
  desc?: string;
}

export const MODEL_PRESETS: ModelPreset[] = [
  { label: 'GLM-5.2', value: 'wandb-proxy/zai-org/GLM-5.2', desc: 'Most capable — best for agentic tasks' },
  { label: 'Qwen 3.8 Max', value: 'dashscope-china/qwen3.8-max', desc: 'Fast — great for everyday requests' },
  { label: 'GLM-5.2 Smol', value: 'synthetic-openai/hf:zai-org/GLM-5.2', desc: 'Lightest — quickest replies' },
  { label: 'MiniMax M3', value: 'minimax-china-proxy/MiniMax-M3', desc: 'Long context — strong reasoning' },
  { label: 'Muse Spark', value: 'meta/muse-spark-1.2', desc: 'Balanced — general purpose' },
];

export const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'max'] as const;
export type ThinkingLevel = typeof THINKING_LEVELS[number];
