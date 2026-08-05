import type { PathLike } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import {
  buildAgentMediaEnv,
  isLocalSameOrigin,
  resolveOdBin,
  startServer,
} from '../src/server.js';

function existsOnly(...paths: string[]) {
  const allowed = new Set(paths);
  return (candidate: PathLike) => allowed.has(String(candidate));
}

describe('resolveOdBin', () => {
  it('prefers the CLI next to a packaged daemon dist module', () => {
    const moduleDir = '/App/Contents/Resources/app/node_modules/@open-design/daemon/dist';
    const expected = path.join(moduleDir, 'cli.js');

    expect(resolveOdBin(moduleDir, { existsSync: existsOnly(expected) })).toBe(expected);
  });

  it('resolves the monorepo CLI from the compiled daemon dist directory', () => {
    const root = path.resolve(import.meta.dirname, '../../..');
    const moduleDir = path.join(root, 'apps', 'daemon', 'dist');
    const expected = path.join(moduleDir, 'cli.js');

    expect(resolveOdBin(moduleDir, { existsSync: existsOnly(expected) })).toBe(expected);
  });

  it('resolves the built CLI when the server is loaded from src via tsx', () => {
    const root = path.resolve(import.meta.dirname, '../../..');
    const moduleDir = path.join(root, 'apps', 'daemon', 'src');
    const expected = path.join(root, 'apps', 'daemon', 'dist', 'cli.js');

    expect(resolveOdBin(moduleDir, { existsSync: existsOnly(expected) })).toBe(expected);
  });
});

describe('buildAgentMediaEnv', () => {
  it('embeds the bound daemon port rather than a 0 placeholder', () => {
    expect(
      buildAgentMediaEnv({
        odBin: '/tmp/cli.js',
        daemonPort: 18456,
        projectId: 'proj-1',
        projectDir: '/tmp/project',
      }),
    ).toEqual({
      OD_BIN: '/tmp/cli.js',
      OD_DAEMON_URL: 'http://127.0.0.1:18456',
      OD_PROJECT_ID: 'proj-1',
      OD_PROJECT_DIR: '/tmp/project',
    });
  });
});

describe('isLocalSameOrigin', () => {
  it('accepts loopback host/origin for the bound port', () => {
    expect(
      isLocalSameOrigin(
        { headers: { host: '127.0.0.1:18456', origin: 'http://127.0.0.1:18456' } },
        18456,
      ),
    ).toBe(true);
  });

  it('rejects the ephemeral 0 placeholder once a real port is bound', () => {
    expect(
      isLocalSameOrigin(
        { headers: { host: '127.0.0.1:18456', origin: 'http://127.0.0.1:18456' } },
        0,
      ),
    ).toBe(false);
  });
});

describe('startServer ephemeral media origin', () => {
  let server: { close: (cb: (err?: Error | null) => void) => void } | null = null;

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('accepts media wait calls on the actually bound port when launched with port 0', async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: { close: (cb: (err?: Error | null) => void) => void };
    };
    server = started.server;
    const actualPort = Number(new URL(started.url).port);
    expect(actualPort).toBeGreaterThan(0);

    const resp = await fetch(`${started.url}/api/media/tasks/missing/wait`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: `http://127.0.0.1:${actualPort}`,
      },
      body: JSON.stringify({}),
    });

    // Bound-port origin checks pass; missing task yields 404 (not 403).
    expect(resp.status).toBe(404);
  });
});
