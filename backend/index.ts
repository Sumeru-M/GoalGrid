/**
 * Composition root. Wires a KVStore → repositories → service → router and
 * exposes both an in-process client (for on-device use, no HTTP) and the raw
 * router (for the optional Node server).
 */

import { KVStore, MemoryKVStore } from "./storage/kvstore";
import { DeviceStore } from "./storage/repositories";
import { PlannerService } from "./services/plannerService";
import { buildRouter } from "./api/handlers";
import { ApiResponse, Router } from "./api/router";

export interface Backend {
  store: DeviceStore;
  service: PlannerService;
  router: Router;
  /** In-process API client — the app calls this instead of doing HTTP. */
  client: ApiClient;
}

/**
 * Ergonomic in-process client. On device the app never opens a socket; it calls
 * these methods, which dispatch straight through the router (same validation,
 * same error mapping as the HTTP transport).
 */
export class ApiClient {
  constructor(private router: Router) {}

  request(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    return this.router.dispatch(method, path, body ?? null);
  }
  get(path: string) { return this.request("GET", path); }
  post(path: string, body?: unknown) { return this.request("POST", path, body); }
  put(path: string, body?: unknown) { return this.request("PUT", path, body); }
  del(path: string) { return this.request("DELETE", path); }
}

/**
 * Create a backend bound to a given on-device KVStore. Defaults to in-memory,
 * which is what tests and previews use; production passes an AsyncStorage/MMKV/
 * SQLite-backed KVStore so data persists on the user's device.
 */
export function createBackend(kv: KVStore = new MemoryKVStore()): Backend {
  const store = new DeviceStore(kv);
  const service = new PlannerService(store);
  const router = buildRouter(service);
  const client = new ApiClient(router);
  return { store, service, router, client };
}

export type { KVStore } from "./storage/kvstore";
export { MemoryKVStore } from "./storage/kvstore";
// Node-only; import directly from ./storage/fileKVStore in Node contexts.
export { DeviceStore } from "./storage/repositories";
export { PlannerService } from "./services/plannerService";
export type { Router, ApiRequest, ApiResponse } from "./api/router";
