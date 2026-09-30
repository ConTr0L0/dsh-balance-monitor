/**
 * Durable preferences for dsh-balance-monitor.
 *
 * DSH 0.2 derives a plugin's editable settings form from the entries its own
 * config editor admits, and an out-of-tree bundle's row is not among them:
 * `settings.describe()` never returns this plugin's form (verified on
 * 0.2.0-rc.2), so a `settings.update()` write would throw. Preferences
 * therefore live in the plugin's own document, next to its ledger:
 *
 *   $DSH_HOME/storages/dsh-balance-monitor/prefs.json
 *
 * Writes are atomic (temp file + rename) and carry a revision the client echoes
 * back, so a stale save is refused instead of clobbering a newer one. Secrets
 * never leave the host unredacted: `config/get` answers with `redactPrefs()` and
 * a `{path, set}` slot list, mirroring DSH's `role("secret")` projection.
 *
 * @module dsh-balance-monitor/prefs
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PREFS_VERSION, PrefsSchema } from "./config.js";

/** Absolute path of the preferences document. */
export function prefsPath(home) {
  return join(home, "storages", "dsh-balance-monitor", "prefs.json");
}

/** A fresh document: schema defaults, revision 0. */
export function emptyPrefs(fallback) {
  return { version: PREFS_VERSION, revision: 0, value: PrefsSchema(fallback ?? {}) };
}

/**
 * Load the document, falling back to the Loader-parsed Config defaults.
 * A corrupt or older document is discarded rather than half-applied.
 */
export function loadPrefs(home, fallback) {
  try {
    const file = prefsPath(home);
    if (!existsSync(file)) return emptyPrefs(fallback);
    const raw = JSON.parse(readFileSync(file, "utf8"));
    if (!raw || typeof raw !== "object" || raw.version !== PREFS_VERSION) return emptyPrefs(fallback);
    return {
      version: PREFS_VERSION,
      revision: typeof raw.revision === "number" ? raw.revision : 0,
      value: PrefsSchema(raw.value ?? fallback ?? {}),
    };
  } catch {
    return emptyPrefs(fallback);
  }
}

/** Persist the document atomically. */
export function savePrefs(home, document) {
  const file = prefsPath(home);
  const tmp = `${file}.tmp-${process.pid}`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(tmp, JSON.stringify(document), "utf8");
  renameSync(tmp, file);
}

/**
 * Secret positions the schema declares (`apiKey` per provider) with presence.
 * @param value - resolved preferences.
 */
export function secretSlots(value) {
  return Object.keys(value.providers ?? {}).map((provider) => {
    const key = value.providers?.[provider]?.apiKey;
    return { path: ["providers", provider, "apiKey"], set: typeof key === "string" && key !== "" };
  });
}

/** Detached copy with every secret field removed (the wire form). */
export function redactPrefs(value) {
  const copy = structuredClone(value);
  for (const slot of secretSlots(value)) {
    let node = copy;
    for (const key of slot.path.slice(0, -1)) node = node?.[key];
    if (node !== undefined && node !== null) delete node[slot.path.at(-1)];
  }
  return copy;
}
