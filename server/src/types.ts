/*
 * PURPOSE: Shared TypeScript types for the OMP bridge server.
 * Defines the OMP JSON event stream, WebSocket protocol, and session models.
 *
 * KEY DECISIONS:
 * - OMP JSON mode (--mode=json) outputs one JSON object per line per event.
 * - We forward these events to the mobile app via WebSocket with minimal transformation.
 * - Session data is read from OMP's JSONL files at ~/.omp/agent/sessions/.
 */

import type { ModelCatalogEntry } from "./models.ts";

// ─── OMP JSON Event Types (from `omp --mode=json`) ────────────────────────────

export interface OmpSessionEvent {
  type: "session";
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
}

export interface OmpAgentStartEvent {
  type: "agent_start";
}

export interface OmpTurnStartEvent {
  type: "turn_start";
}

export interface OmpMessageStartEvent {
  type: "message_start";
  message: OmpMessage;
}

export interface OmpMessageUpdateEvent {
  type: "message_update";
  assistantMessageEvent: {
    type: "text_start" | "text_delta" | "text_end" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "thinking_start" | "thinking_delta" | "thinking_end";
    contentIndex?: number;
    delta?: string;
    content?: string;
    toolCallId?: string;
    toolName?: string;
    args?: string;
  };
}

export interface OmpMessageEndEvent {
  type: "message_end";
  message: OmpMessage;
}

export interface OmpTurnEndEvent {
  type: "turn_end";
  message: OmpMessage;
  toolResults: unknown[];
}

export interface OmpAgentEndEvent {
  type: "agent_end";
  messages: OmpMessage[];
  isTerminal: boolean;
}

export interface OmpCustomEvent {
  type: "custom";
  customType: string;
  data?: unknown;
  content?: string;
  display?: boolean;
  id?: string;
  parentId?: string;
  timestamp?: string;
}

export type OmpEvent =
  | OmpSessionEvent
  | OmpAgentStartEvent
  | OmpTurnStartEvent
  | OmpMessageStartEvent
  | OmpMessageUpdateEvent
  | OmpMessageEndEvent
  | OmpTurnEndEvent
  | OmpAgentEndEvent
  | OmpCustomEvent
  | { type: string; [key: string]: unknown };

// ─── OMP Message Model ────────────────────────────────────────────────────────

export interface OmpContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "image";
  text?: string;
  thinking?: string;
  thinkingSignature?: string;
  toolCallId?: string;
  toolName?: string;
  args?: string;
  content?: string;
  image?: string;
}

export interface OmpUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export interface OmpMessage {
  role: "user" | "assistant" | "system";
  content: OmpContentBlock[];
  attribution?: string;
  timestamp?: number;
  api?: string;
  provider?: string;
  model?: string;
  usage?: OmpUsage;
  stopReason?: string;
  responseId?: string;
  duration?: number;
  ttft?: number;
  completedAt?: number;
}

// ─── WebSocket Protocol (Client → Server) ─────────────────────────────────────

export interface WsSendCommand {
  type: "send";
  content: string;
  sessionId?: string | null;
  model?: string;
  thinking?: string;
  autoApprove?: boolean;
  approvalMode?: "auto" | "ask" | "readonly";
  cwd?: string;
}

export interface WsListSessionsCommand {
  type: "list_sessions";
}

export interface WsGetHistoryCommand {
  type: "get_history";
  sessionId: string;
}

export interface WsGetStatusCommand {
  type: "get_status";
}

export interface WsCancelCommand {
  type: "cancel";
}

export interface WsForkSessionCommand {
  type: "fork_session";
  sessionId: string;
  messageCount: number;
}

export interface WsDeleteSessionCommand {
  type: "delete_session";
  sessionId: string;
}

export interface WsRenameSessionCommand {
  type: "rename_session";
  sessionId: string;
  title: string;
}

export interface WsUploadCommand {
  type: "upload";
  name: string;
  data: string;
  cwd?: string;
}

export interface WsStartTunnelCommand {
  type: "start_tunnel";
}

export interface WsStopTunnelCommand {
  type: "stop_tunnel";
}

export type WsClientCommand =
  | WsSendCommand
  | WsListSessionsCommand
  | WsGetHistoryCommand
  | WsGetStatusCommand
  | WsCancelCommand
  | WsStartTunnelCommand
  | WsStopTunnelCommand
  | WsForkSessionCommand
  | WsDeleteSessionCommand
  | WsRenameSessionCommand
  | WsUploadCommand;

// ─── WebSocket Protocol (Server → Client) ─────────────────────────────────────

export interface WsEventMessage {
  type: "event";
  sessionId: string;
  event: OmpEvent;
}

export interface WsCompleteMessage {
  type: "complete";
  sessionId: string;
}

export interface WsErrorMessage {
  type: "error";
  message: string;
  sessionId?: string;
}

export interface WsSessionsMessage {
  type: "sessions";
  sessions: SessionSummary[];
}

export interface WsHistoryMessage {
  type: "history";
  sessionId: string;
  messages: OmpMessage[];
  title?: string;
}

export interface WsStatusMessage {
  type: "status";
  status: ServerStatus;
}

export interface WsSessionMutatedMessage {
  type: "forked" | "deleted" | "renamed";
  sessionId: string;
  sessions: SessionSummary[];
}

export interface WsUploadedMessage {
  type: "uploaded";
  path: string;
}

export interface WsSessionActiveMessage {
  type: "session_active";
  sessionId: string;
  active: boolean;
}

export interface WsTunnelMessage {
  type: "tunnel";
  url: string | null;
  status: "starting" | "active" | "stopped" | "error";
}

export type WsServerMessage =
  | WsEventMessage
  | WsCompleteMessage
  | WsErrorMessage
  | WsSessionsMessage
  | WsHistoryMessage
  | WsStatusMessage
  | WsTunnelMessage
  | WsSessionMutatedMessage
  | WsUploadedMessage
  | WsSessionActiveMessage;

// ─── Session Models ───────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  title: string;
  timestamp: string;
  cwd: string;
  messageCount: number;
  size: number;
}

export interface ServerStatus {
  ompVersion: string;
  uptime: number;
  tunnelUrl: string | null;
  tunnelStatus: "stopped" | "starting" | "active" | "error";
  activeSessions: number;
  totalSessions: number;
  models: ModelCatalogEntry[];
}
