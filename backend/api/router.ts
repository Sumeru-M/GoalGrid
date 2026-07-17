/**
 * A tiny, framework-agnostic router.
 *
 * Handlers are pure `(ApiRequest) => Promise<ApiResponse>` functions, so the
 * exact same API can be driven three ways with no code changes:
 *   • in-process, on-device  → call `router.dispatch(...)` directly (no HTTP)
 *   • local dev / stateless compute server → node:http adapter (see server.ts)
 *   • tests                  → construct ApiRequests by hand
 *
 * Path params use `:name` segments (e.g. `/goals/:id`).
 */

export interface ApiRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export type Handler = (req: ApiRequest) => Promise<ApiResponse>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export function ok(body: unknown, status = 200): ApiResponse {
  return { status, body };
}
export function err(status: number, message: string, extra?: unknown): ApiResponse {
  return { status, body: { error: message, ...(extra ? { details: extra } : {}) } };
}

export class Router {
  private routes: Route[] = [];

  register(method: string, pattern: string, handler: Handler): this {
    this.routes.push({
      method: method.toUpperCase(),
      segments: split(pattern),
      handler,
    });
    return this;
  }
  get(p: string, h: Handler) { return this.register("GET", p, h); }
  post(p: string, h: Handler) { return this.register("POST", p, h); }
  put(p: string, h: Handler) { return this.register("PUT", p, h); }
  delete(p: string, h: Handler) { return this.register("DELETE", p, h); }

  private match(method: string, path: string): { route: Route; params: Record<string, string> } | null {
    const parts = split(path);
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      if (route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const seg = route.segments[i];
        if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(parts[i]);
        else if (seg !== parts[i]) { ok = false; break; }
      }
      if (ok) return { route, params };
    }
    return null;
  }

  /** Dispatch a request. Never throws — maps errors to structured responses. */
  async dispatch(
    method: string,
    rawPath: string,
    body: unknown = null,
  ): Promise<ApiResponse> {
    const [path, queryString] = rawPath.split("?");
    const matched = this.match(method, path);
    if (!matched) return err(404, `no route for ${method} ${path}`);

    const req: ApiRequest = {
      method: method.toUpperCase(),
      path,
      params: matched.params,
      query: parseQuery(queryString),
      body,
    };

    try {
      return await matched.route.handler(req);
    } catch (e) {
      return mapError(e);
    }
  }
}

function split(p: string): string[] {
  return p.split("/").filter(Boolean);
}

function parseQuery(qs?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!qs) return out;
  for (const pair of qs.split("&")) {
    const [k, v = ""] = pair.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

// Error → HTTP mapping. Kept here so every transport gets identical semantics.
import { NotFoundError, ValidationError } from "../services/plannerService";
function mapError(e: unknown): ApiResponse {
  if (e instanceof ValidationError) return err(400, e.message);
  if (e instanceof NotFoundError) return err(404, e.message);
  const message = e instanceof Error ? e.message : "internal error";
  return err(500, message);
}
