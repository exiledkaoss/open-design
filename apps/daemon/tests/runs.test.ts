// @ts-nocheck
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import { createChatRunService } from '../src/runs.js';

describe('createChatRunService', () => {
  it('retains all events for active runs so reconnect replay does not lose output', () => {
    const runs = createTestRunService({ maxEvents: 3 });
    const run = runs.create();
    run.status = 'running';

    for (let i = 1; i <= 5; i += 1) {
      runs.emit(run, 'stdout', { chunk: String(i) });
    }

    const res = new FakeResponse();
    runs.stream(run, fakeRequest(), res);

    expect(res.sse.sent.map((record) => record.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('trims stored events only after a run reaches a terminal state', () => {
    const runs = createTestRunService({ maxEvents: 3 });
    const run = runs.create();
    run.status = 'running';

    for (let i = 1; i <= 4; i += 1) {
      runs.emit(run, 'stdout', { chunk: String(i) });
    }
    runs.finish(run, 'succeeded', 0, null);

    const res = new FakeResponse();
    runs.stream(run, fakeRequest(), res);

    expect(res.sse.sent.map((record) => record.id)).toEqual([3, 4, 5]);
    expect(res.sse.sent.at(-1)).toMatchObject({
      event: 'end',
      data: { code: 0, signal: null, status: 'succeeded' },
    });
    expect(res.sse.ended).toBe(true);
  });
});

function createTestRunService({ maxEvents }) {
  return createChatRunService({
    maxEvents,
    ttlMs: 60_000,
    createSseResponse: (res) => {
      const sse = {
        sent: [],
        ended: false,
        cleaned: false,
        send(event, data, id = null) {
          this.sent.push({ event, data, id });
          return true;
        },
        end() {
          this.ended = true;
        },
        cleanup() {
          this.cleaned = true;
        },
      };
      res.sse = sse;
      return sse;
    },
    createSseErrorPayload: (code, message, init = {}) => ({
      error: { code, message, ...init },
    }),
  });
}

function fakeRequest(after = undefined) {
  return {
    query: after === undefined ? {} : { after },
    get: () => undefined,
  };
}

class FakeResponse extends EventEmitter {
  sse = null;
}
