import type { KVStore } from "../../../backend/storage/kvstore";

/**
 * Browser on-device store. Implements the same KVStore contract the backend
 * repositories sit on, backed by window.localStorage — the web equivalent of
 * React Native's AsyncStorage. All user data therefore stays on the device;
 * nothing is sent to a server.
 *
 * Keys are namespaced so multiple apps can share localStorage safely.
 */
export class LocalStorageKV implements KVStore {
  constructor(private ns = "goalgrid:") {}

  private k(key: string) {
    return this.ns + key;
  }

  async get(key: string): Promise<string | null> {
    return window.localStorage.getItem(this.k(key));
  }
  async set(key: string, value: string): Promise<void> {
    window.localStorage.setItem(this.k(key), value);
  }
  async delete(key: string): Promise<void> {
    window.localStorage.removeItem(this.k(key));
  }
  async keys(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const full = this.ns + prefix;
    for (let i = 0; i < window.localStorage.length; i++) {
      const raw = window.localStorage.key(i);
      if (raw && raw.startsWith(full)) out.push(raw.slice(this.ns.length));
    }
    return out;
  }
  async clear(): Promise<void> {
    // Only clear our namespace, not the whole origin.
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const raw = window.localStorage.key(i);
      if (raw && raw.startsWith(this.ns)) toRemove.push(raw);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  }
}
