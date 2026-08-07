import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveMessage } from './projects';
import type { ChatMessage } from '../types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveMessage', () => {
  it('serializes concurrent PUTs so an older snapshot cannot finish after a newer one', async () => {
    const bodies: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let inFlight = 0;
    let maxInFlight = 0;

    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (bodies.length === 0) {
        bodies.push(body);
        await firstGate;
      } else {
        bodies.push(body);
      }
      inFlight -= 1;
      return new Response(JSON.stringify({ message: {} }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const older: ChatMessage = {
      id: 'asst-1',
      role: 'assistant',
      content: 'old',
      runId: undefined,
      runStatus: 'running',
    };
    const newer: ChatMessage = {
      id: 'asst-1',
      role: 'assistant',
      content: 'new-complete',
      runId: 'run-1',
      runStatus: 'succeeded',
      lastRunEventId: '42',
    };

    const first = saveMessage('proj', 'conv', older);
    const second = saveMessage('proj', 'conv', newer);
    // Give the first PUT time to start and block before releasing it.
    await Promise.resolve();
    await Promise.resolve();
    releaseFirst?.();
    await Promise.all([first, second]);

    expect(maxInFlight).toBe(1);
    expect(bodies).toHaveLength(2);
    expect(JSON.parse(bodies[0]!).content).toBe('old');
    expect(JSON.parse(bodies[1]!).content).toBe('new-complete');
    expect(JSON.parse(bodies[1]!).runId).toBe('run-1');
  });
});
