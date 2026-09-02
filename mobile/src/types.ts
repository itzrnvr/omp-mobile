/*
 * PURPOSE: Shared TypeScript types for the OMP bridge WebSocket protocol.
 * Covers OMP streaming events, chat messages, session summaries, server
 * status, and the client/server WebSocket message envelopes.
 *
 * These are plain interfaces kept simple on purpose — the bridge protocol
 * is the single source of truth for their shape. Untrusted/external fields
 * (tool args, usage stats, custom payloads) are typed `unknown` so callers
 * must validate before consuming them.
 */

// ─── Content blocks & messages ────────────────────────────────────────────────

export type OmpContentBlockType = 'text' | 'thinking' | 'tool_use' | 'tool_result';

export interface OmpContentBlock {
  type: OmpContentBlockType;
  /** Present when type === 'text'. */
  text?: string;
  /** Present when type === 'thinking'. */
  thinking?: string;
  /** Present when type === 'tool_use'. */
  toolName?: string;
  /** Tool call arguments (type === 'tool_use'); unvalidated server payload. */
  args?: unknown;
  /** Tool result payload (type === 'tool_result'); unvalidated server payload. */
  content?: unknown;
}

export type OmpMessageRole = 'user' | 'assistant' | 'system';

export interface OmpMessage {
  role: OmpMessageRole;
  content: OmpContentBlock[];
  model?: string;
  /** Token usage stats from the provider; shape varies by provider. */
  usage?: unknown;
  cost?: number;
  duration?: number;
  /** Time to first token, ms. */
  ttft?: number;
}

// ─── Session summary (list_sessions response) ──────────────────────────────────

export interface SessionSummary {
  id: string;
  title: string;
  timestamp: number;
  cwd?: string;
  messageCount: number;
  size: number;
}

// ─── Server status (get_status response) ───────────────────────────────────────

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
  | 'custom';

export type AssistantMessageEventType = 'text_start' | 'text_delta' | 'text_end';

export interface AssistantMessageEvent {
  type: AssistantMessageEventType;
  /** The delta text for text_delta; full text for text_start/text_end. */
  text?: string;
  /** The delta text for text_delta events (OMP uses this field). */
  delta?: string;
  contentIndex?: number;
  content?: string;
}

export interface OmpEvent {
  type: OmpEventType;
  sessionId?: string;
  /** Full message object for message_start, message_end, turn_end events. */
  message?: OmpMessage;
  role?: OmpMessageRole;
  model?: string;
  /** Final content for message events that carry it directly. */
  content?: OmpContentBlock[];
  /** Streaming sub-events for message_update. */
  assistantMessageEvent?: AssistantMessageEvent;
  /** Token usage stats; shape varies by provider. */
  usage?: unknown;
  cost?: number;
  duration?: number;
  ttft?: number;
  /** Arbitrary payload for 'custom' events; unvalidated. */
  data?: unknown;
}

// ─── WebSocket protocol envelopes ──────────────────────────────────────────────

/** Commands the client sends to the bridge server. */
export type WsClientCommand =
  | {
      type: 'send';
      content: string;
      sessionId?: string | null;
      model?: string;
      thinking?: string;
      autoApprove?: boolean;
      cwd?: string;
    }
  | { type: 'list_sessions' }
  | { type: 'get_history'; sessionId: string }
  | { type: 'get_status' }
  | { type: 'cancel' }
  | { type: 'start_tunnel' }
  | { type: 'stop_tunnel' };

/** Messages the bridge server sends to the client. */
export type WsServerMessage =
  | { type: 'event'; sessionId: string; event: OmpEvent }
  | { type: 'complete'; sessionId: string }
  | { type: 'error'; message: string; sessionId?: string }
  | { type: 'sessions'; sessions: SessionSummary[] }
  | { type: 'history'; sessionId: string; messages: OmpMessage[]; title?: string }
  | { type: 'status'; status: ServerStatus }
  | { type: 'tunnel'; url: string | null; status: string };
