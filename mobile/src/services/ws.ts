/*
 * PURPOSE: WebSocket service for the OMP bridge server.
 * Wraps React Native's built-in WebSocket with auto-reconnect (exponential
 * backoff, max 5 attempts) and a simple callback API.
 *
 * The service owns one socket at a time and reports parsed server messages
 * via onMessage and connection state via onStatusChange. It is intentionally
 * framework-agnostic — the Zustand store wires the callbacks.
 */

import type { WsClientCommand, WsServerMessage } from '../types';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url = '';
  private token = '';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  // Node's setTimeout (typed via @types/node) returns a NodeJS.Timeout handle;
  // stored so a pending reconnect can be cancelled on disconnect.
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;

  /** Called for every parsed server message. */
  onMessage: ((msg: WsServerMessage) => void) | null = null;
  /** Called whenever the connection state changes. */
  onStatusChange: ((status: WsStatus) => void) | null = null;

  /** Open (or re-open) a connection to the bridge server. */
  connect(url: string, token: string): void {
    this.url = url;
    this.token = token;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.open();
  }

  /** Send a client command. Returns false if the socket is not open. */
  send(cmd: WsClientCommand): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(cmd));
      return true;
    } catch {
      return false;
    }
  }

  /** Close the connection and stop auto-reconnect. */
  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore close errors */
      }
    }
    this.setStatus('disconnected');
  }

  // ─── internals ──────────────────────────────────────────────────────────────

  /** Cancel any pending reconnect timer. */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Normalize the stored URL to a ws:// / wss:// URL with ?token= appended. */
  private buildUrl(): string {
    let u = this.url.trim();
    if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
    else if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
    else if (!u.startsWith('ws://') && !u.startsWith('wss://')) u = 'ws://' + u;
    const sep = u.includes('?') ? '&' : '?';
    return u + sep + 'token=' + encodeURIComponent(this.token);
  }

  private open(): void {
    const wsUrl = this.buildUrl();
    this.setStatus('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      // Synchronous construction failure — try again later.
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
    };

    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(e.data) as WsServerMessage;
      } catch {
        return; // ignore malformed frames
      }
      this.onMessage?.(msg);
    };

    ws.onerror = () => {
      // A close event will follow and drive reconnect logic.
    };

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.handleClose();
    };
  }

  private handleClose(): void {
    if (!this.shouldReconnect) {
      this.setStatus('disconnected');
      return;
    }
    this.scheduleReconnect();
  }

  /** Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped). Give up after 5 tries. */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.shouldReconnect = false;
      this.setStatus('disconnected');
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 16000);
    // Still attempting — surface as connecting so the UI shows a retry in flight.
    this.setStatus('connecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private setStatus(status: WsStatus): void {
    this.onStatusChange?.(status);
  }
}
