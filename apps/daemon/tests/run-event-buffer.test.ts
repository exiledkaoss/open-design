// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

import { createChatRunService } from '../src/runs.js';

function createRuns(maxEvents = 3) {
  return createChatRunService({
    createSseResponse: () => ({
      send: vi.fn(),
      end: vi.fn(),
      cleanup: vi.fn(),
      writeKeepAlive: () => true,
    }),
    createSseErrorPayload: (code: string, message: string) => ({
      error: { code, message },
    }),
    maxEvents,
    ttlMs: 60_000,
  });
}

describe('createChatRunService event buffer', () => {
  it('keeps all events while the run is active so reattach after= cursors stay valid', () => {
    const runs = createRuns(3);
    const run = runs.create({ projectId: 'p1', conversationId: 'c1' });
    for (let i = 0; i < 10; i += 1) {
      runs.emit(run, 'stdout', { chunk: String(i) });
    }

    expect(run.events).toHaveLength(10);
    expect(run.events[0]?.id).toBe(1);
    expect(run.events[9]?.id).toBe(10);

    const replayed: number[] = [];
    const sse = {
      send: (_event: string, _data: unknown, id: number) => {
        replayed.push(id);
        return true;
      },
      end: vi.fn(),
      cleanup: vi.fn(),
      writeKeepAlive: () => true,
    };
    const localRuns = createChatRunService({
      createSseResponse: () => sse,
      createSseErrorPayload: (code: string, message: string) => ({
        error: { code, message },
      }),
      maxEvents: 3,
      ttlMs: 60_000,
    });
    const run2 = localRuns.create({});
    for (let i = 0; i < 10; i += 1) {
      localRuns.emit(run2, 'stdout', { chunk: String(i) });
    }
    const fakeReq = {
      get: () => '',
      query: { after: '2' },
    };
    const fakeRes = { on: vi.fn() };
    localRuns.stream(run2, fakeReq, fakeRes);
    expect(replayed).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('trims the event buffer only after the run becomes terminal', () => {
    const runs = createRuns(3);
    const run = runs.create({});
    for (let i = 0; i < 10; i += 1) {
      runs.emit(run, 'stdout', { chunk: String(i) });
    }
    expect(run.events).toHaveLength(10);

    runs.finish(run, 'succeeded', 0, null);
    // finish emits an `end` event then trims to maxEvents.
    expect(run.events.length).toBeLessThanOrEqual(3);
    expect(run.events.at(-1)?.event).toBe('end');
  });
});
