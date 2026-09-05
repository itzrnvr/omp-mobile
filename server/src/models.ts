/*
 * PURPOSE: Full model catalog for the mobile model picker, parsed from omp's
 * own config (~/.omp/agent/models.yml): providers → models[] with id, name,
 * reasoning, contextWindow. Cached by file mtime so repeated status calls are
 * cheap.
 *
 * WHY: the mobile picker previously showed only 5 hardcoded presets; the user
 * wants every model with search/filter, grouped by provider.
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

let cache: { mtimeMs: number; entries: ModelCatalogEntry[] } | null = null;

export function loadModelCatalog(): ModelCatalogEntry[] {
  try {
    const st = statSync(MODELS_YML);
    if (cache && cache.mtimeMs === st.mtimeMs) return cache.entries;
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
    cache = { mtimeMs: st.mtimeMs, entries };
    return entries;
  } catch {
    return cache?.entries ?? [];
  }
}
