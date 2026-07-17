/**
 * On-device storage abstraction.
 *
 * The entire persistence layer sits on a tiny async key-value contract. This is
 * deliberate: it maps 1:1 onto every practical on-device store —
 *   • React Native  → AsyncStorage / MMKV
 *   • Expo          → expo-secure-store / SQLite KV table
 *   • Web / PWA     → IndexedDB / localStorage
 *   • Tests / Node  → in-memory or JSON file (provided here)
 *
 * User data therefore never has to leave the device: repositories serialise
 * domain objects as JSON documents over whichever KVStore the host binds.
 */
export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** All keys beginning with `prefix` (used to enumerate collections). */
  keys(prefix: string): Promise<string[]>;
  /** Wipe everything (e.g. "delete my data" / account reset). */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory adapter — tests, previews, ephemeral sessions.
// ---------------------------------------------------------------------------

export class MemoryKVStore implements KVStore {
  private map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}
