/**
 * Node-only FileKVStore. Isolated in its own module so the browser bundle never
 * transitively imports `node:fs`. Single-file JSON persistence for local dev
 * and the demo (no concurrency guarantees — not for production device use).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { KVStore } from "./kvstore";

export class FileKVStore implements KVStore {
  private cache: Record<string, string> | null = null;

  constructor(private path: string) {}

  private async load(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(this.path, "utf8"));
    } catch {
      this.cache = {};
    }
    return this.cache!;
  }

  private async flush(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.cache ?? {}, null, 2));
  }

  async get(key: string): Promise<string | null> {
    const data = await this.load();
    return key in data ? data[key] : null;
  }
  async set(key: string, value: string): Promise<void> {
    const data = await this.load();
    data[key] = value;
    await this.flush();
  }
  async delete(key: string): Promise<void> {
    const data = await this.load();
    delete data[key];
    await this.flush();
  }
  async keys(prefix: string): Promise<string[]> {
    const data = await this.load();
    return Object.keys(data).filter((k) => k.startsWith(prefix));
  }
  async clear(): Promise<void> {
    this.cache = {};
    await this.flush();
  }
}
