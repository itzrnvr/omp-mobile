/*
 * PURPOSE: Session management — reads OMP's JSONL session files from the
 * filesystem to provide session lists and history to the mobile app.
 *
 * KEY DECISIONS:
 * - OMP stores sessions at ~/.omp/agent/sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl
 * - The encoding replaces : and \ with -- (e.g. C:\tmp → --C--tmp--)
 * - We parse the JSONL to extract title, timestamp, session ID, and message count
 * - Advisor session files (suffix __advisor.*) are excluded from the list
 *
 * GOTCHAS:
 * - Session files can be large; we read them in full for messageCount (could optimize)
 * - File names contain Unicode subscript characters that may garble in some tools
 * - The `title` event is usually the first line, `session` event is second
 */

import { homedir } from "node:os";
import { join, sep } from "node:path";
import { readdirSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import type { SessionSummary, OmpMessage } from "./types.ts";

const SESSIONS_DIR = join(homedir(), ".omp", "agent", "sessions");

/**
 * Decode an OMP session directory name back to a working directory path.
 * `--C--tmp--` → `C:\tmp` (on Windows)
 */
function decodeCwd(dirName: string): string {
  let decoded = dirName.replace(/^-+/, "").replace(/-+$/, "");
  decoded = decoded.replace(/--/g, sep);
  if (process.platform === "win32" && /^[A-Za-z]\\/.test(decoded)) {
    decoded = decoded[0] + ":" + decoded.slice(1);
  }
  return decoded;
}

interface SessionHeader {
  title: string;
  sessionId: string;
  timestamp: string;
  messageCount: number;
}

/**
/** Pull plain text out of a message content field (string or content-part array). */
function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join(" ")
      .trim();
  }
  return "";
}

/**
 * Parse a JSONL session file to extract metadata and message count.
 */
async function parseSessionFile(filePath: string): Promise<SessionHeader | null> {
  try {
    const text = await Bun.file(filePath).text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;

    let title = "Untitled";
    let sessionId = "";
    let timestamp = "";
    let messageCount = 0;
    let firstUserText = "";

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "title" && obj.title) {
          title = obj.title;
        } else if (obj.type === "session" && obj.id) {
          sessionId = obj.id;
          timestamp = obj.timestamp || "";
        } else if (obj.type === "message") {
          messageCount++;
          if (!firstUserText && obj.message?.role === "user") {
            firstUserText = extractText(obj.message.content);
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    // Fall back to the first user message when OMP emitted no title event.
    if (title === "Untitled" && firstUserText) {
      title = firstUserText.length > 48 ? firstUserText.slice(0, 48) + "…" : firstUserText;
    }

    // Extract session ID from filename if not found in content
    if (!sessionId) {
      const filename = filePath.split(sep).pop() || "";
      const match = filename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
      if (match) sessionId = match[1];
    }

    if (!sessionId) return null;

    // Extract timestamp from filename if not in content
    if (!timestamp) {
      const filename = filePath.split(sep).pop() || "";
      const tsMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      if (tsMatch) timestamp = tsMatch[1];
    }

    return { title, sessionId, timestamp, messageCount };
  } catch {
    return null;
  }
}

/**
 * List all OMP sessions, sorted newest first.
 */
export async function listSessions(): Promise<SessionSummary[]> {
  const sessions: SessionSummary[] = [];

  let cwdDirs: Dirent[];
  try {
    cwdDirs = readdirSync(SESSIONS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const dir of cwdDirs) {
    if (!dir.isDirectory()) continue;

    const dirPath = join(SESSIONS_DIR, dir.name);
    const cwd = decodeCwd(dir.name);

    let files: string[];
    try {
      files = readdirSync(dirPath).filter(
        (f) => f.endsWith(".jsonl") && !f.includes("__advisor"),
      );
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(dirPath, file);
      let size: number;
      try {
        size = statSync(filePath).size;
      } catch {
        continue;
      }

      const header = await parseSessionFile(filePath);
      if (!header) continue;

      sessions.push({
        id: header.sessionId,
        title: header.title,
        timestamp: header.timestamp,
        cwd,
        messageCount: header.messageCount,
        size,
      });
    }
  }

  sessions.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  return sessions;
}

/**
 * Find a session JSONL file by session ID.
 */
async function findSessionFile(sessionId: string): Promise<string | null> {
  let cwdDirs: Dirent[];
  try {
    cwdDirs = readdirSync(SESSIONS_DIR, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const dir of cwdDirs) {
    if (!dir.isDirectory()) continue;

    const dirPath = join(SESSIONS_DIR, dir.name);
    let files: string[];
    try {
      files = readdirSync(dirPath).filter(
        (f) => f.endsWith(".jsonl") && !f.includes("__advisor"),
      );
    } catch {
      continue;
    }

    for (const file of files) {
      if (file.includes(sessionId)) {
        return join(dirPath, file);
      }
    }
  }

  return null;
}

/**
 * Get full message history for a session.
 */
export async function getSessionHistory(
  sessionId: string,
): Promise<{ messages: OmpMessage[]; title: string } | null> {
  const filePath = await findSessionFile(sessionId);
  if (!filePath) return null;

  try {
    const text = await Bun.file(filePath).text();
    const lines = text.split("\n").filter((l) => l.trim());
    const messages: OmpMessage[] = [];
    let title = "Untitled";

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "title" && obj.title) {
          title = obj.title;
        } else if (obj.type === "message" && obj.message) {
          messages.push(obj.message as OmpMessage);
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    return { messages, title };
  } catch {
    return null;
  }
}
