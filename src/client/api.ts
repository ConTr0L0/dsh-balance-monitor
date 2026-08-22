/**
 * Client-side RPC + wire types for dsh-balance-monitor.
 * Mirrors the host half's payloads; the wire is untyped JSON.
 */

export type ProviderId = "deepseek" | "zhipu" | "openrouter" | "tavily";

export interface ProviderBalance {
  ok: boolean;
  fetchedAt?: number;
  configured?: boolean;
  currency?: string;
  total?: number;
  available?: number;
  granted?: number;
  toppedUp?: number;
  used?: number;
  remaining?: number;
  limit?: number | null;
  voucher?: number;
  cash?: number;
  currentPlan?: string;
  error?: string;
}

export interface LimitRow {
  key: "daily" | "total" | "requests";
  labelKey: string;
  enabled: boolean;
  value: number;
  action: "warn" | "block";
  current: number;
  exceeded: boolean;
  remaining: number | null;
  progress: number;
}

export interface Overview {
  enabled: boolean;
  refreshInterval: number;
  providers: Record<string, ProviderBalance>;
  display: {
    provider: string;
    field: "total" | "available";
    showBalance: boolean;
    showToday: boolean;
    showRemaining: boolean;
    showPeak: boolean;
    showRefresh: boolean;
  };
  today: { cost: number; requests: number };
  totals: { cost: number; requests: number };
  lastEventAt: number;
  limits: LimitRow[];
  peak: { status: "peak" | "off-peak"; windows: string[][]; offPeakFactor: number };
  pricing: { source: string; fetchedAt: number; modelCount: number };
  savedAt: number;
}

export interface SessionRow {
  id: string;
  title: string;
  workspace: string;
  cost: number;
  requests: number;
  firstEvent: number;
  lastEvent: number;
  tokens: { uncached: number; cacheRead: number; output: number };
  models: Record<string, number>;
}

export interface History {
  daily: Record<string, { cost: number; requests: number }>;
  totals: { cost: number; requests: number };
}

export interface SecretSlot {
  path: string[];
  set: boolean;
}

export interface ConfigValue {
  value: Record<string, unknown>;
  secrets: SecretSlot[] | undefined;
  revision: number;
}

export class RpcError extends Error {}

export type RpcCall = <T>(endpoint: string, payload?: unknown) => Promise<T>;

/** Build the channel-bound RPC caller for the plugin's connection. */
export function createRpc(connection: { rpc: { call: (...args: unknown[]) => Promise<unknown> } }): RpcCall {
  const call = async <T>(endpoint: string, payload?: unknown): Promise<T> => {
    const response = (await connection.rpc.call(
      "/dsh-balance-monitor",
      endpoint,
      payload ?? {},
    )) as { ok: boolean; value?: T; error?: { message?: string } };
    if (!response.ok) {
      const error = new RpcError(response.error?.message ?? `RPC ${endpoint} failed`);
      throw error;
    }
    return response.value as T;
  };
  return call;
}
