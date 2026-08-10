// @ts-nocheck
import { afterEach, describe, expect, it } from 'vitest';
import { startServer } from '../src/server.js';

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        }),
    ),
  );
});

async function waitForTerminalRun(url, runId) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const resp = await fetch(`${url}/api/runs/${encodeURIComponent(runId)}`);
    expect(resp.ok).toBe(true);
    const body = await resp.json();
    if (body.status === 'failed' || body.status === 'succeeded' || body.status === 'canceled') {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`run ${runId} did not reach a terminal status`);
}

describe('chat run project scoping', () => {
  it('fails closed when projectId is missing instead of spawning in the daemon cwd', async () => {
    const { url, server } = await startServer({ port: 0, returnServer: true });
    servers.push(server);

    const createResp = await fetch(`${url}/api/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'claude',
        message: 'touch OWNED_BY_UNSCOPED_AGENT',
      }),
    });
    expect(createResp.status).toBe(202);
    const { runId } = await createResp.json();
    expect(typeof runId).toBe('string');

    const status = await waitForTerminalRun(url, runId);
    expect(status).toMatchObject({
      status: 'failed',
      projectId: null,
    });

    const eventsResp = await fetch(`${url}/api/runs/${encodeURIComponent(runId)}/events`);
    expect(eventsResp.ok).toBe(true);
    const eventsText = await eventsResp.text();
    expect(eventsText).toMatch(/projectId required/);
    expect(eventsText).not.toMatch(/^event: start$/m);
  });

  it('fails closed when projectId is invalid instead of falling back to PROJECT_ROOT', async () => {
    const { url, server } = await startServer({ port: 0, returnServer: true });
    servers.push(server);

    const createResp = await fetch(`${url}/api/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'claude',
        message: 'hello',
        projectId: '../escape',
      }),
    });
    expect(createResp.status).toBe(202);
    const { runId } = await createResp.json();

    const status = await waitForTerminalRun(url, runId);
    expect(status.status).toBe('failed');
    expect(status.projectId).toBe('../escape');

    const eventsResp = await fetch(`${url}/api/runs/${encodeURIComponent(runId)}/events`);
    const eventsText = await eventsResp.text();
    expect(eventsText).toMatch(/invalid project id/);
    expect(eventsText).not.toMatch(/^event: start$/m);
  });
});
