import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KVStore } from "goalgrid-backend/storage/kvstore";

/**
 * On-device storage for React Native. Implements the same KVStore contract the
 * backend repositories sit on, backed by AsyncStorage — the exact same seam the
 * web app fills with localStorage. Swapping storage per platform is one class.
 * All user data stays on the device; nothing is sent to a server.
 */
export class AsyncStorageKV implements KVStore {
  constructor(private ns = "goalgrid:") {}

  private k(key: string) {
    return this.ns + key;
  }

  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(this.k(key));
  }
  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(this.k(key), value);
  }
  async delete(key: string): Promise<void> {
    await AsyncStorage.removeItem(this.k(key));
  }
  async keys(prefix: string): Promise<string[]> {
    const all = await AsyncStorage.getAllKeys();
    const full = this.ns + prefix;
    return all.filter((k) => k.startsWith(full)).map((k) => k.slice(this.ns.length));
  }
  async clear(): Promise<void> {
    // Only clear our namespace, not the whole app's AsyncStorage.
    const all = await AsyncStorage.getAllKeys();
    const mine = all.filter((k) => k.startsWith(this.ns));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  }
}
