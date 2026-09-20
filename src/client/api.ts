/**
 * Client-side RPC + wire types for dsh-balance-monitor.
 * Mirrors the host half's payloads; the wire is untyped JSON.
 */

export type ProviderId = "deepseek" | "zhipu" | "openrouter" | "tavily";

export interface ProviderBalance {
  ok: boolean;
  /** When the published figures were actually fetched (last success). */
  fetchedAt?: number;
  /** When the host last tried to poll (even if that attempt failed). */
  attemptedAt?: number;
  /** When the last failed poll happened. */
  failedAt?: number;
  /** Attempts the host spent on the last poll. */
  attempts?: number;
  /** False when the failure was authoritative (HTTP error), not transport. */
  retryable?: boolean;
  /** True when the figures are the last known ones — the latest poll failed. */
  stale?: boolean;
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

export interface ModelStat {
  requests: number;
  input: number;
  cacheRead: number;
  output: number;
  cost: number;
}

export interface DayStat {
  cost: number;
  requests: number;
  models: Record<string, ModelStat>;
}

/** One model's peak-price triple (CNY / 1M tokens). */
export interface PriceTriple {
  input: number;
  cacheHit: number;
  output: number;
}

/** A synced snapshot of the official price table (see lib/pricing.js). */
export interface PricingSnapshot {
  source: string;
  fetchedAt: number;
  models: Record<string, PriceTriple>;
  peakWindows: string[][];
  offPeakFactor: number;
  weekendOffPeak: boolean;
  /** Since 2026-09: Chinese statutory holidays are off-peak all day. */
  holidayOffPeak?: boolean;
}

/** Pending pricing-change popup payload: the table before and after a change. */
export interface PricingNotice {
  fetchedAt: number;
  old: PricingSnapshot;
  new: PricingSnapshot;
}

export interface Overview {
  enabled: boolean;
  refreshInterval: number;
  providers: Record<string, ProviderBalance>;
  display: {
    provider: string;
    field: "total" | "available";
    visibleModels: string[];
    showBalance: boolean;
    showToday: boolean;
    showRemaining: boolean;
    showPeak: boolean;
    showRefresh: boolean;
  };
  today: DayStat;
  totals: { cost: number; requests: number };
  models: Record<string, ModelStat>;
  lastEventAt: number;
  limits: LimitRow[];
  peak: { status: "peak" | "off-peak"; windows: string[][]; offPeakFactor: number };
  pricing: { source: string; fetchedAt: number; modelCount: number };
  pricingNotice: PricingNotice | null;
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
  parentSession: string;
  tokens: { uncached: number; cacheRead: number; output: number };
  models: Record<string, number>;
}

export interface History {
  daily: Record<string, DayStat>;
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
