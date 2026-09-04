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
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type TunnelStatus = "stopped" | "starting" | "active" | "error";

export interface TunnelState {
  url: string | null;
  status: TunnelStatus;
}

let tunnelProc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
let currentUrl: string | null = null;
let currentStatus: TunnelStatus = "stopped";

/** Gist that holds the current tunnel URL so clients can bootstrap without manual entry. */
const GIST_ID = "b5167afad091916fc99263f1e45c7519";

/** Resolve the cloudflared binary: bundled bin/ first, then PATH. */
function resolveCloudflared(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = join(here, "..", "bin", "cloudflared.exe");
  if (existsSync(bundled)) return bundled;
  return "cloudflared";
}

/** Publish the current tunnel URL to the bootstrap gist (best-effort, fire-and-forget). */
async function publishTunnelUrl(url: string): Promise<void> {
  try {
    const tokenProc = Bun.spawnSync(["gh", "auth", "token"]);
    const token = new TextDecoder().decode(tokenProc.stdout).trim();
    if (!token) return;
    const content = JSON.stringify({ url, updated: Date.now() });
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: { "omp-tunnel.json": { content } } }),
    });
  } catch {
    // Publishing is best-effort; the tunnel still works without it.
  }
}

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
    [resolveCloudflared(), "tunnel", "--url", `http://localhost:${port}`],
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
        void publishTunnelUrl(currentUrl);
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
