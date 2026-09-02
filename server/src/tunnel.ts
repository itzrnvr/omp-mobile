/*
 * PURPOSE: Manages a Cloudflare quick tunnel to expose the bridge server
 * for remote access when the phone is not on local WiFi.
 *
 * KEY DECISIONS:
 * - Uses `cloudflared tunnel --url http://localhost:PORT` for a quick tunnel.
 * - Quick tunnels give a random trycloudflare.com URL — no account needed.
 * - The URL is parsed from cloudflared's stderr output.
 *
 * GOTCHAS:
 * - cloudflared prints the URL to stderr, not stdout.
 * - The URL line looks like: "Your quick Tunnel has been created! Visit it at: https://xxx.trycloudflare.com"
 * - The process must stay alive for the tunnel to work; we track it for cleanup.
 */

import type { Subprocess } from "bun";

export type TunnelStatus = "stopped" | "starting" | "active" | "error";

export interface TunnelState {
  url: string | null;
  status: TunnelStatus;
}

let tunnelProc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
let currentUrl: string | null = null;
let currentStatus: TunnelStatus = "stopped";

/**
 * Start a Cloudflare quick tunnel to the given localhost port.
 * Returns when the tunnel URL is detected or timeout is reached.
 */
export async function startTunnel(port: number): Promise<TunnelState> {
  // Kill existing tunnel if any
  stopTunnel();

  currentStatus = "starting";
  currentUrl = null;

  tunnelProc = Bun.spawn(
    ["cloudflared", "tunnel", "--url", `http://localhost:${port}`],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  // Read stderr to find the tunnel URL
  const reader = tunnelProc.stderr.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Wait up to 15 seconds for the URL to appear
  const timeout = Date.now() + 15000;

  while (Date.now() < timeout) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
    // Match the tunnel URL from cloudflared output
    const urlMatch = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (urlMatch) {
        currentUrl = urlMatch[0];
        currentStatus = "active";
        reader.releaseLock();
        return { url: currentUrl, status: "active" };
      }
    }
  }

  reader.releaseLock();
  currentStatus = "error";
  return { url: null, status: "error" };
}

/**
 * Stop the Cloudflare tunnel.
 */
export function stopTunnel(): TunnelState {
  if (tunnelProc) {
    try {
      tunnelProc.kill();
    } catch {
      // Process may have already exited
    }
    tunnelProc = null;
  }
  currentUrl = null;
  currentStatus = "stopped";
  return { url: null, status: "stopped" };
}

/**
 * Get the current tunnel state.
 */
export function getTunnelState(): TunnelState {
  return { url: currentUrl, status: currentStatus };
}
