/**
 * Fenced HTTP JSON-RPC route for this plugin's client half.
 *
 * DSH 0.2 stopped handing the `connection` service to profile plugins (the
 * 0.1.x `connection.rpc.handle(channel, handler)` registration silently never
 * ran — the browser then got HTTP 405 from the static handler). The supported
 * channel is a prefix route the host mounts itself through
 * `ctx.webServer.register(route)`; the fence below mirrors
 * `@deepseek-ai/dsh-client-connection`'s loopback / trusted-host + Host/Origin
 * policy, exactly the classification shipped plugins copy for their own routes.
 *
 * Wire contract — one endpoint per POST, JSON in and out:
 *
 *   POST /dsh-balance-monitor/<endpoint>   { …payload }
 *   → {"ok":true,"value":…} | {"ok":false,"error":{"code","message"}}
 *
 * @module dsh-balance-monitor/rpc
 */

/** Path prefix owning every endpoint of this plugin. */
export const CHANNEL = "/dsh-balance-monitor";
/** Endpoints live under the channel; each segment may be dotted/dashed. */
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
/** Reject request bodies beyond this size (a runaway client must not buffer the host). */
const MAX_BODY_BYTES = 1024 * 1024;

/** One header value as a trimmed string, or undefined when absent/repeated-empty. */
function headerValue(headers, name) {
  const raw = headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Whether a WHATWG URL hostname names the loopback authority. */
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return undefined;
  }
}

/** `hostname` for a port-less trusted entry, else `hostname:port` (see dsh docs). */
function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
  return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}

/** Whether the request authority matches a `trustedHosts` entry. */
function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry);
    if (entryUrl === undefined) return false;
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host;
  });
}

/**
 * Host/Origin fence for one route: loopback (or a configured trusted host) plus
 * a same-origin Origin, and never a cross-site fetch.
 * @param trustedHosts - accessor for the deployment's extra authorities.
 */
export function createTrustFence(trustedHosts) {
  return {
    isTrusted(req) {
      const host = headerValue(req.headers, "host");
      if (host === undefined) return false;
      const hostUrl = parseAuthority(host.trim().toLowerCase());
      if (hostUrl === undefined) return false;
      if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts())) return false;
      if (headerValue(req.headers, "sec-fetch-site") === "cross-site") return false;
      const origin = headerValue(req.headers, "origin");
      if (origin === undefined) return true;
      try {
        return new URL(origin).host === hostUrl.host;
      } catch {
        return false;
      }
    },
  };
}

/** Write one JSON response. */
function writeJson(res, status, value) {
  res.statusCode = status;
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

/** Read a bounded JSON body; undefined for an empty body. */
async function readJsonBody(req) {
  let body = "";
  let bytes = 0;
  for await (const chunk of req) {
    bytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`);
    body += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }
  if (body === "") return undefined;
  return JSON.parse(body);
}

/** Endpoint (`config/get`) named by a request path, or undefined when it is not ours. */
function endpointFromPath(pathname) {
  if (!pathname.startsWith(`${CHANNEL}/`)) return undefined;
  const endpoint = pathname.slice(CHANNEL.length + 1);
  const segments = endpoint.split("/");
  if (segments.length === 0 || segments.some((segment) => !ENDPOINT_SEGMENT_PATTERN.test(segment))) return undefined;
  return endpoint;
}

/**
 * Build the prefix route for `ctx.webServer.register`.
 * @param options - fence inputs, the endpoint handler, and a logger.
 * @param options.trustedHosts - accessor for `ctx.webRuntime?.trustedHosts`.
 * @param options.handler - `(endpoint, payload) => Promise<{ok,value}|{ok:false,error}>`.
 * @param options.logger - plugin logger (warnings only).
 * @returns a WebRoute (`kind: "prefix"`).
 */
export function createRpcRoute({ trustedHosts, handler, logger }) {
  const fence = createTrustFence(trustedHosts);
  return {
    kind: "prefix",
    path: CHANNEL,
    async handler(req, res) {
      if (!fence.isTrusted(req)) {
        writeJson(res, 403, { ok: false, error: { code: "forbidden", message: "untrusted host" } });
        return;
      }
      const pathname = (req.url ?? "").split(/[?#]/, 1)[0];
      const endpoint = endpointFromPath(pathname);
      if ((req.method ?? "GET") !== "POST" || endpoint === undefined) {
        writeJson(res, 404, { ok: false, error: { code: "not_found", message: `unknown endpoint ${pathname}` } });
        return;
      }
      let payload;
      try {
        payload = await readJsonBody(req);
      } catch (error) {
        writeJson(res, 400, { ok: false, error: { code: "bad-request", message: error?.message ?? String(error) } });
        return;
      }
      try {
        writeJson(res, 200, await handler(endpoint, payload));
      } catch (error) {
        logger?.warn?.("dsh-balance-monitor: rpc %s failed: %s", endpoint, error?.message ?? error);
        writeJson(res, 500, { ok: false, error: { code: "internal", message: error?.message ?? String(error) } });
      }
    },
  };
}
