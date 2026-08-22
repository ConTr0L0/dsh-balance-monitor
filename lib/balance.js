/**
 * Balance fetchers for the supported providers.
 *
 * Normalized output per provider:
 *   { ok: true, currency, total, available, ...providerFields }
 *   { ok: false, error }
 *
 * @module dsh-balance-monitor/balance
 */

const TIMEOUT_MS = 10_000;

/** Coerce a possibly-string numeric field to a finite number (NaN → 0). */
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toBalance(ok) {
  return (body) => ok(body);
}

async function requestJson(url, headers, body) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!response.ok) {
    const detail = parsed?.error?.message || parsed?.message || text.slice(0, 200) || `HTTP ${response.status}`;
    return { ok: false, error: `${response.status}: ${detail}` };
  }
  return { ok: true, body: parsed };
}

/** DeepSeek: GET {base}/user/balance */
export async function fetchDeepSeekBalance(baseURL, apiKey) {
  const url = `${String(baseURL).replace(/\/$/, "")}/user/balance`;
  const result = await requestJson(url, { authorization: `Bearer ${apiKey}` });
  if (!result.ok) return result;
  const infos = result.body?.balance_infos ?? [];
  const entry = infos.find((item) => item?.currency === "CNY") ?? infos[0];
  if (!entry) return { ok: false, error: "empty balance_infos" };
  const total = num(entry.total_balance);
  return {
    ok: true,
    currency: entry.currency ?? "CNY",
    total,
    available: total,
    granted: num(entry.granted_balance),
    toppedUp: num(entry.topped_up_balance),
    isAvailable: result.body?.is_available !== false,
  };
}

/** Zhipu GLM: GET {base}/users/me/balance — code 0 with data.* fields. */
export async function fetchZhipuBalance(baseURL, apiKey) {
  const root = String(baseURL).replace(/\/$/, "");
  const result = await requestJson(`${root}/users/me/balance`, {
    authorization: `Bearer ${apiKey}`,
  });
  if (!result.ok) return result;
  const body = result.body ?? {};
  const data = body.data ?? body;
  const available = num(data.available_balance ?? data.available ?? data.total ?? 0);
  const total = num(data.total ?? data.cash_balance ?? available);
  return {
    ok: true,
    currency: "CNY",
    total,
    available,
    voucher: num(data.voucher_balance ?? data.voucher ?? 0),
    cash: num(data.cash_balance ?? data.cash ?? 0),
  };
}

/** OpenRouter: GET {base}/credits */
export async function fetchOpenRouterBalance(baseURL, apiKey) {
  const root = String(baseURL).replace(/\/$/, "");
  const result = await requestJson(`${root}/credits`, {
    authorization: `Bearer ${apiKey}`,
  });
  if (!result.ok) return result;
  const credits = result.body?.credits ?? {};
  const total = num(credits.total);
  const used = num(credits.used);
  const remaining = num(credits.remaining ?? Math.max(0, total - used));
  return {
    ok: true,
    currency: "USD",
    total,
    available: remaining,
    used,
    remaining,
    limit: credits.limit === null ? null : num(credits.limit),
  };
}

/** Tavily: GET {base}/usage (Bearer or api_key query auth). */
export async function fetchTavilyUsage(baseURL, apiKey) {
  const root = String(baseURL).replace(/\/$/, "");
  const result = await requestJson(`${root}/usage`, {
    authorization: `Bearer ${apiKey}`,
  });
  if (!result.ok) {
    // Some deployments accept the key as a query parameter.
    const result2 = await requestJson(`${root}/usage?api_key=${encodeURIComponent(apiKey)}`);
    if (!result2.ok) return result2;
    return normalizeTavily(result2.body);
  }
  return normalizeTavily(result.body);
}

function normalizeTavily(body) {
  const key = body?.key ?? {};
  const account = body?.account ?? {};
  const used = num(key.usage ?? account.plan_usage ?? 0);
  const limit = key.limit === null || key.limit === undefined ? null : num(key.limit);
  return {
    ok: true,
    currency: "USD",
    total: limit === null ? used : limit,
    available: limit === null ? null : Math.max(0, limit - used),
    used,
    limit,
    currentPlan: account.current_plan ?? "",
    searchUsage: num(key.search_usage ?? 0),
    extractUsage: num(key.extract_usage ?? 0),
    crawlUsage: num(key.crawl_usage ?? 0),
    mapUsage: num(key.map_usage ?? 0),
  };
}

/** Dispatch one provider fetch by id. */
export async function fetchProviderBalance(provider, baseURL, apiKey) {
  switch (provider) {
    case "deepseek":
      return fetchDeepSeekBalance(baseURL, apiKey);
    case "zhipu":
      return fetchZhipuBalance(baseURL, apiKey);
    case "openrouter":
      return fetchOpenRouterBalance(baseURL, apiKey);
    case "tavily":
      return fetchTavilyUsage(baseURL, apiKey);
    default:
      return { ok: false, error: `unknown provider: ${provider}` };
  }
}
