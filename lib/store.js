/**
 * Durable state store for dsh-balance-monitor.
 *
 * State is a single JSON document at
 * $DSH_HOME/storages/dsh-balance-monitor/state.json, written atomically
 * (temp file + rename) so a crash never truncates history.
 *
 * @module dsh-balance-monitor/store
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const STATE_VERSION = 2;

export function statePath(home) {
  return join(home, "storages", "dsh-balance-monitor", "state.json");
}

/** Create an empty state document. */
export function emptyState() {
  return {
    version: STATE_VERSION,
    sessions: {},
    daily: {},
    models: {},
    totals: { cost: 0, requests: 0 },
    lastEventAt: 0,
    savedAt: 0,
    pricing: null,
  };
}

/** Load persisted state; returns an empty state when absent or corrupt. */
export function loadState(home) {
  const file = statePath(home);
  try {
    if (!existsSync(file)) return emptyState();
    const raw = JSON.parse(readFileSync(file, "utf8"));
    if (!raw || typeof raw !== "object" || raw.version !== STATE_VERSION) return emptyState();
    return {
      version: STATE_VERSION,
      sessions: raw.sessions ?? {},
      daily: raw.daily ?? {},
      models: raw.models ?? {},
      totals: {
        cost: typeof raw.totals?.cost === "number" ? raw.totals.cost : 0,
        requests: typeof raw.totals?.requests === "number" ? raw.totals.requests : 0,
      },
      lastEventAt: typeof raw.lastEventAt === "number" ? raw.lastEventAt : 0,
      savedAt: typeof raw.savedAt === "number" ? raw.savedAt : 0,
      pricing: raw.pricing ?? null,
    };
  } catch {
    return emptyState();
  }
}

/** Persist state atomically (temp file in the same directory + rename). */
export function saveState(home, state) {
  const file = statePath(home);
  const tmp = `${file}.tmp-${process.pid}`;
  mkdirSync(dirname(file), { recursive: true });
  state.savedAt = Date.now();
  writeFileSync(tmp, JSON.stringify(state), "utf8");
  renameSync(tmp, file);
}
