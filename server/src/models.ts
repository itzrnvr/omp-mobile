/*
 * PURPOSE: Full model catalog for the mobile model picker.
 *
 * SOURCE OF TRUTH (2026-09-05): `omp models ls --json` — the SAME catalog the
 * omp TUI picker shows (68 providers / 2300+ models, incl. opencode-zen and
 * the full opencode-go list). Parsing models.yml alone showed only the
 * user-pinned subset (50/252), which is why providers looked "missing".
 * models.yml remains the OFFLINE FALLBACK if the CLI call fails.
 *
 * CACHING: the CLI call costs ~1-10s, so results are cached with a 5-min TTL
 * and served stale-while-revalidate afterwards; first call is synchronous so
 * boot status already carries a catalog.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, statSync } from "node:fs";
import { parse } from "yaml";

export interface ModelCatalogEntry {
  /** Value passed to omp --model: "<provider>/<id>". */
  value: string;
  label: string;
  provider: string;
  reasoning: boolean;
  contextWindow: number;
  desc?: string;
}

const MODELS_YML = join(homedir(), ".omp", "agent", "models.yml");
const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; entries: ModelCatalogEntry[] } | null = null;
let inflight: Promise<ModelCatalogEntry[]> | null = null;

interface LsModel {
  provider?: string;
  id?: string;
  selector?: string;
  name?: string;
  contextWindow?: number;
  reasoning?: boolean;
}

function fromCli(): ModelCatalogEntry[] | null {
  try {
    const proc = Bun.spawnSync(["omp", "models", "ls", "--json"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (proc.exitCode !== 0) return null;
    const text = new TextDecoder().decode(proc.stdout);
    const doc = JSON.parse(text) as { models?: LsModel[] };
    const list = doc.models || [];
    if (list.length === 0) return null;
    const entries: ModelCatalogEntry[] = [];
    for (const m of list) {
      if (!m.selector || !m.provider) continue;
      entries.push({
        value: m.selector,
        label: m.name || m.id || m.selector,
        provider: m.provider,
        reasoning: !!m.reasoning,
        contextWindow: m.contextWindow || 0,
      });
    }
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

function fromYml(): ModelCatalogEntry[] {
  try {
    const doc = parse(readFileSync(MODELS_YML, "utf-8")) as {
      providers?: Record<
        string,
        { models?: { id?: string; name?: string; reasoning?: boolean; contextWindow?: number }[] }
      >;
    };
    const entries: ModelCatalogEntry[] = [];
    for (const [provider, cfg] of Object.entries(doc.providers || {})) {
      for (const m of cfg.models || []) {
        if (!m.id) continue;
        entries.push({
          value: `${provider}/${m.id}`,
          label: m.name || m.id,
          provider,
          reasoning: !!m.reasoning,
          contextWindow: m.contextWindow || 0,
        });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

async function refresh(): Promise<ModelCatalogEntry[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const entries = fromCli() ?? fromYml();
    cache = { at: Date.now(), entries };
    inflight = null;
    return entries;
  })();
  return inflight;
}

/** Synchronous catalog read; triggers a background refresh when stale. */
export function loadModelCatalog(): ModelCatalogEntry[] {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.entries;
  if (cache) {
    void refresh();
    return cache.entries;
  }
  const entries = fromCli() ?? fromYml();
  cache = { at: Date.now(), entries };
  return entries;
}

/** Force a refresh (WS command) and return the fresh catalog. */
export async function refreshModelCatalog(): Promise<ModelCatalogEntry[]> {
  return refresh();
}

/** Warm the cache at boot so the first status call is instant. */
export function warmModelCatalog(): void {
  void refresh();
}
