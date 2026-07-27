import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { JSON_BODY_LIMIT } from '../src/server.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        }),
    ),
  );
});

async function listen(app: express.Express): Promise<{ url: string; server: Server }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${address.port}`, server };
}

describe('JSON_BODY_LIMIT', () => {
  it('accepts chat-sized payloads above the historical 4mb cap', async () => {
    const app = express();
    app.use(express.json({ limit: JSON_BODY_LIMIT }));
    app.put('/message', (req, res) => {
      res.json({ bytes: Buffer.byteLength(JSON.stringify(req.body)) });
    });
    const { url } = await listen(app);

    const body = JSON.stringify({
      id: 'assistant-1',
      role: 'assistant',
      content: 'A'.repeat(5 * 1024 * 1024),
      events: [],
    });
    expect(Buffer.byteLength(body)).toBeGreaterThan(4 * 1024 * 1024);

    const resp = await fetch(`${url}/message`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    expect(resp.status).toBe(200);
    const json = (await resp.json()) as { bytes: number };
    expect(json.bytes).toBeGreaterThan(4 * 1024 * 1024);
  });
});
