/**
 * Reactive client store for dsh-balance-monitor (module-scope, one per page).
 */
import type { History, Overview, RpcCall, SessionRow } from "./api";

export interface ClientState {
  overview: Overview | null;
  history: History | null;
  sessions: SessionRow[];
  loading: boolean;
  error: string | null;
  refreshedAt: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();

export const state: ClientState = {
  overview: null,
  history: null,
  sessions: [],
  loading: true,
  error: null,
  refreshedAt: 0,
};

function notify() {
  for (const listener of [...listeners]) listener();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot() {
  return state;
}

let inflight: Promise<void> | null = null;

/** Refresh overview + history, optionally the full session list. */
export async function refreshAll(rpc: RpcCall, includeSessions = false) {
  if (inflight !== null) return inflight;
  inflight = (async () => {
    try {
      const [overview, history, sessionPage] = await Promise.all([
        rpc<Overview>("overview"),
        rpc<History>("history"),
        includeSessions ? rpc<{ rows: SessionRow[] }>("sessions", { limit: 200 }) : Promise.resolve(null),
      ]);
      state.overview = overview;
      state.history = history;
      if (sessionPage) state.sessions = sessionPage.rows;
      state.error = null;
      state.refreshedAt = Date.now();
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      notify();
    }
  })();
  await inflight;
  inflight = null;
}

/** Manual balance refresh (also refreshes overview to surface the result). */
export async function manualRefresh(rpc: RpcCall) {
  try {
    await rpc("refresh");
  } catch {
    /* individual provider errors surface in the overview payload */
  }
  await refreshAll(rpc, true);
}
