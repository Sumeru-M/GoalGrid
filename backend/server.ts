/**
 * Optional Node HTTP adapter.
 *
 * IMPORTANT — privacy posture: the product stores user data ON THE DEVICE. This
 * server exists only for (a) local development against the same router, and
 * (b) an optional *stateless compute* deployment where the device POSTs its own
 * state, the server computes a schedule, and returns it WITHOUT PERSISTING
 * anything. Point the backend at a MemoryKVStore per request/instance so no
 * user data is retained server-side.
 *
 * Run locally:  tsx backend/server.ts   (defaults to a FileKVStore for dev)
 */

import { createServer } from "node:http";
import { createBackend } from "./index";
import { FileKVStore } from "./storage/fileKVStore";

export function startServer(opts: { port?: number; dbPath?: string } = {}) {
  const port = opts.port ?? 8787;
  // Dev convenience only. A stateless-compute deployment would instead build a
  // fresh MemoryKVStore per request from the posted payload.
  const kv = opts.dbPath ? new FileKVStore(opts.dbPath) : undefined;
  const backend = createBackend(kv);

  const MAX_BODY_BYTES = 1_000_000; // 1 MB — a device's full state is far smaller

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "payload too large" }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", async () => {
      if (aborted) return;
      let body: unknown = null;
      if (chunks.length) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid JSON body" }));
          return;
        }
      }
      const result = await backend.router.dispatch(req.method ?? "GET", req.url ?? "/", body);
      res.writeHead(result.status, { "content-type": "application/json" });
      res.end(JSON.stringify(result.body));
    });
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`GoalGrid backend listening on http://localhost:${port}`);
  });
  return server;
}

// Run directly?
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer({ dbPath: process.env.GG_DB ?? ".data/dev.json" });
}
