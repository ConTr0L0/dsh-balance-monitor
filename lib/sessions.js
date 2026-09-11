/**
 * Session-log scanning and event folding for dsh-balance-monitor.
 *
 * Session logs live at $DSH_HOME/sessions/<workspace-dir>/<session-id>/ as a
 * CONCATENATION of independent zstd frames (one frame per append; a frame may
 * hold several JSONL events). DSH <=0.1.4 wrote session.jsonl.zstd; 0.1.5+
 * writes session.v3.jsonl.zstd with the SAME frame/JSONL structure and an
 * event schema that is compatible for usage accounting (verified 2026-09-11:
 * assistant/message usage{inputTokens,cacheReadTokens,outputTokens}, message.id,
 * turn/step and request/header.config.provider|model are all unchanged). A
 * session that straddles the upgrade keeps its pre-upgrade events in the
 * legacy file and post-upgrade ones in the v3 file; BOTH are scanned and the
 * global message.id dedupe absorbs any overlap. Node's zstdDecompressSync only
 * decodes the first frame, so callers must split by the frame magic
 * (28 B5 2F FD) and decode each frame separately. Frames are immutable
 * appends, so an incremental reader can resume from a byte offset that lands
 * exactly on a frame boundary.
 *
 * @module dsh-balance-monitor/sessions
 */
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import { dayKey, requestCost } from "./config.js";

const FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

/**
 * Session log file names by format generation. Scanning is per existing file;
 * an unrecognized session*.jsonl.zstd name is reported to the caller (once)
 * instead of being silently ignored — a future format must never reopen the
 * 0.1.5 blindness gap.
 */
export const LOG_FILE_NAMES = ["session.v3.jsonl.zstd", "session.jsonl.zstd"];
const KNOWN_LOG_FILES = new Set(LOG_FILE_NAMES);
const LOG_FILE_PATTERN = /^session(?:\.[^.]+)?\.jsonl\.zstd$/;

/** Byte positions of every zstd frame start in a buffer. */
export function frameStarts(buf) {
  const positions = [];
  let index = 0;
  while (true) {
    const found = buf.indexOf(FRAME_MAGIC, index);
    if (found === -1) break;
    positions.push(found);
    index = found + 4;
  }
  return positions;
}

/**
 * Decode frames at or after `fromOffset`. Stops at the first frame that fails
 * to decode (an in-progress tail frame) or before an incomplete trailing
 * frame. Returns the decoded JSONL lines and the byte offset of the first
 * UNconsumed frame (the resume point).
 */
export function decodeFrames(buf, fromOffset = 0) {
  const positions = frameStarts(buf);
  const lines = [];
  let consumedOffset = fromOffset;
  for (let i = 0; i < positions.length; i += 1) {
    const start = positions[i];
    if (start < fromOffset) continue;
    const end = positions[i + 1] ?? buf.length;
    const frame = buf.subarray(start, end);
    let text;
    try {
      text = zstdDecompressSync(frame).toString("utf8");
    } catch {
      break; // tail frame still being written (or corrupt): retry next scan
    }
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line) lines.push(line);
    }
    consumedOffset = end;
  }
  return { lines, nextOffset: consumedOffset };
}

/** Parse one JSONL event line; returns null for unparseable lines. */
export function parseEvent(line) {
  try {
    const event = JSON.parse(line);
    if (event && typeof event.type === "string") return event;
  } catch {
    /* skip malformed line */
  }
  return null;
}

/**
 * Fold one event into a session accumulator and the global stats. This is the
 * single accounting path, shared by the incremental log scan (historical
 * sessions) and by the live `session/event` observer (real-time completions) —
 * both must agree exactly, including the message.id dedupe key, so that a fold
 * from one source suppresses the other rather than double-counting.
 * @param session - session accumulator (see createSessionState).
 * @param stats - global stats: { daily: { "YYYY-MM-DD": {cost, requests} }, totals: {cost, requests} }.
 * @param event - parsed session event.
 * @param prices - resolved prices block.
 * @returns whether the session accumulator changed.
 */
export function foldEvent(session, stats, event, prices) {
  switch (event.type) {
    case "session": {
      if (typeof event.createdAt === "number" && !session.firstEvent) session.firstEvent = event.createdAt;
      const parent = event.data?.parentSession;
      if (typeof parent === "string" && parent) session.parentSession = parent;
      return false;
    }
    case "session/title": {
      if (typeof event.data?.title === "string" && event.data.title) {
        session.title = event.data.title.slice(0, 200);
        return true;
      }
      return false;
    }
    case "request/header": {
      // provider/model marker only — the API call itself is counted at its
      // completion (assistant/message) so requests are never double-counted.
      const config = event.data?.header?.config;
      if (typeof config?.provider === "string" && config.provider) session.currentProvider = config.provider;
      const model = config?.model;
      if (typeof model === "string" && model) session.currentModel = model;
      return false;
    }
    case "assistant/message": {
      const usage = event.data?.usage;
      if (!usage || typeof usage !== "object") return false;
      if (!isDeepseekProvider(session.currentProvider || "")) return false;
      const time = typeof event.time === "number" ? event.time : Date.now();
      // Deduplicate completions by their stable message id: DSH re-writes the
      // same session content into several session files (child sessions and
      // surface copies), so without this every completion is counted many ×.
      const msgId = event.data?.message?.id;
      const dedupeKey =
        typeof msgId === "string" && msgId !== ""
          ? `m:${msgId}`
          : `s:${time}|${usage.inputTokens ?? 0}|${usage.cacheReadTokens ?? 0}|${usage.outputTokens ?? 0}`;
      stats.seenIds ??= {};
      if (stats.seenIds[dedupeKey]) return false;
      stats.seenIds[dedupeKey] = 1;
      const model = session.currentModel || "";
      const { cost, tokens } = requestCost(usage, model, time, prices);
      session.cost += cost;
      session.tokens.uncached += tokens.uncached;
      session.tokens.cacheRead += tokens.cacheRead;
      session.tokens.output += tokens.output;
      session.requests += 1;
      session.requestsByModel[model] = (session.requestsByModel[model] ?? 0) + 1;
      stats.totals.cost += cost;
      stats.totals.requests += 1;
      // all-time per-model stats
      const modelKey = model || "unknown";
      const modelStat = (stats.models[modelKey] ??= emptyModelStats());
      modelStat.requests += 1;
      modelStat.input += tokens.uncached;
      modelStat.cacheRead += tokens.cacheRead;
      modelStat.output += tokens.output;
      modelStat.cost += cost;
      // per-day stats (incl. per-day per-model for the stacked/heat charts)
      const day = dayKey(time);
      const slot = (stats.daily[day] ??= { cost: 0, requests: 0, models: {} });
      slot.cost += cost;
      slot.requests += 1;
      const dayModel = (slot.models[modelKey] ??= emptyModelStats());
      dayModel.requests += 1;
      dayModel.input += tokens.uncached;
      dayModel.cacheRead += tokens.cacheRead;
      dayModel.output += tokens.output;
      dayModel.cost += cost;
      if (!session.firstEvent || time < session.firstEvent) session.firstEvent = time;
      if (!session.lastEvent || time > session.lastEvent) session.lastEvent = time;
      stats.lastEventAt = Math.max(stats.lastEventAt ?? 0, time);
      return true;
    }
    default:
      return false;
  }
}

/** DeepSeek's first-party platform: the only traffic priced by this plugin. */
export const DEEPSEEK_PROVIDER = "deepseek-official";

/**
 * Whether a provider's traffic belongs to the official DeepSeek platform
 * dashboard. DSH can route other gateways (aliyun/qwen, zhipu, xiaomi,
 * deepseek-modlens, ...) through the same session logs; those must NOT be
 * priced or summed into the DeepSeek figures, or the plugin over-reports.
 * Unknown providers are kept (legacy logs without provider tags).
 */
export function isDeepseekProvider(provider) {
  return provider === "" || provider === DEEPSEEK_PROVIDER;
}

/** Create an empty session accumulator. */
export function createSessionState(id, workspace) {
  return {
    id,
    workspace: workspace ?? "",
    title: "",
    currentModel: "",
    currentProvider: "",
    cost: 0,
    requests: 0,
    firstEvent: 0,
    lastEvent: 0,
    tokens: { uncached: 0, cacheRead: 0, output: 0 },
    requestsByModel: {},
    parentSession: "",
    // Byte cursor per log file name (a session can hold a legacy AND a v3 log).
    offsets: {},
  };
}

/** Create an empty per-model stat accumulator. */
export function emptyModelStats() {
  return { requests: 0, input: 0, cacheRead: 0, output: 0, cost: 0 };
}

/**
 * List every session-log file under `$DSH_HOME/sessions`, across all supported
 * format generations (one entry PER log file; a session may hold two).
 * @param onUnknownLogName - optional (sessionId, fileName) callback fired once
 *   per unrecognized session*.jsonl.zstd name, so a future DSH format surfaces
 *   as a warning instead of silent under-counting.
 * @returns [{ id, workspace, file, fileName, size }] — workspace is the
 *   encoded workspace dir name.
 */
export function listSessionFiles(sessionsRoot, onUnknownLogName) {
  const result = [];
  let workspaces;
  try {
    workspaces = readdirSync(sessionsRoot, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const dir of workspaces) {
    if (!dir.isDirectory()) continue;
    const workspaceDir = join(sessionsRoot, dir.name);
    let sessions;
    try {
      sessions = readdirSync(workspaceDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue;
      const sessionDir = join(workspaceDir, session.name);
      let entries;
      try {
        entries = readdirSync(sessionDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !LOG_FILE_PATTERN.test(entry.name)) continue;
        if (!KNOWN_LOG_FILES.has(entry.name)) {
          onUnknownLogName?.(session.name, entry.name);
          continue;
        }
        const file = join(sessionDir, entry.name);
        try {
          const info = statSync(file);
          result.push({ id: session.name, workspace: dir.name, file, fileName: entry.name, size: info.size });
        } catch {
          /* log file vanished between listing and stat */
        }
      }
    }
  }
  return result;
}

/**
 * Read one session log file and fold its new frames into `session` + `stats`.
 * The byte cursor is tracked per file name in `session.offsets`; a legacy
 * single-cursor `session.offset` (pre-v3-plugin state) is adopted for the
 * legacy file and then retired. Mis-adoption can only cause a re-fold from
 * byte 0, which the global message.id dedupe suppresses — never a double count.
 */
export function syncSessionFile(session, stats, prices, file, fileName = "session.jsonl.zstd") {
  session.offsets ??= {};
  let fromOffset = session.offsets[fileName];
  if (fromOffset === undefined) {
    fromOffset = fileName === "session.jsonl.zstd" && typeof session.offset === "number" ? session.offset : 0;
  }
  if (session.offset !== undefined) delete session.offset;

  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return false;
  }
  const { lines, nextOffset } = decodeFrames(buf, fromOffset);
  if (lines.length === 0) {
    if (nextOffset > fromOffset) session.offsets[fileName] = nextOffset;
    return false;
  }
  let changed = false;
  for (const line of lines) {
    const event = parseEvent(line);
    if (event) changed = foldEvent(session, stats, event, prices) || changed;
  }
  session.offsets[fileName] = nextOffset;
  return changed;
}
