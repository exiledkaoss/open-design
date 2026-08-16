// @ts-nocheck
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import { createChatRunService } from '../src/runs.js';

function createService() {
  return createChatRunService({
    createSseResponse(res) {
      return {
        send(event, data, id) {
          res.sent.push({ event, data, id });
        },
        end() {
          res.ended = true;
        },
        cleanup() {},
      };
    },
    createSseErrorPayload(code, message, init = {}) {
      return { code, message, ...init };
    },
  });
}

function fakeRequest({ after, lastEventId } = {}) {
  return {
    get(name) {
      if (name === 'Last-Event-ID') return lastEventId ?? '';
      return '';
    },
    query: { after: after ?? '' },
  };
}

function fakeResponse() {
  const res = new EventEmitter();
  res.sent = [];
  res.ended = false;
  return res;
}

describe('createChatRunService event replay', () => {
  it('replays every event after lastRunEventId even past the old 2000-event cap', () => {
    const runs = createService();
    const run = runs.create({ projectId: 'p1', conversationId: 'c1' });

    for (let i = 0; i < 2500; i += 1) {
      runs.emit(run, 'stdout', { chunk: `t${i + 1}` });
    }

    const res = fakeResponse();
    runs.stream(run, fakeRequest({ after: '400' }), res);

    expect(res.sent).toHaveLength(2100);
    expect(res.sent[0]).toEqual({ event: 'stdout', data: { chunk: 't401' }, id: 401 });
    expect(res.sent.at(-1)).toEqual({ event: 'stdout', data: { chunk: 't2500' }, id: 2500 });
    expect(res.sent.map((record) => record.id)).toEqual(
      Array.from({ length: 2100 }, (_, i) => 401 + i),
    );
  });

  it('does not leave a gap when the client reconnects after a long disconnect', () => {
    const runs = createService();
    const run = runs.create({ projectId: 'p1', conversationId: 'c1' });

    for (let i = 0; i < 100; i += 1) {
      runs.emit(run, 'agent', { type: 'text_delta', delta: 'a' });
    }

    // Client persisted lastRunEventId=100, then disconnected. The agent
    // keeps streaming well past the previous 2_000-event ring buffer.
    for (let i = 0; i < 3000; i += 1) {
      runs.emit(run, 'agent', { type: 'text_delta', delta: 'b' });
    }

    const res = fakeResponse();
    runs.stream(run, fakeRequest({ after: 100 }), res);

    expect(res.sent).toHaveLength(3000);
    expect(res.sent[0].id).toBe(101);
    expect(res.sent.at(-1).id).toBe(3100);
    expect(res.sent.every((record) => record.data.delta === 'b')).toBe(true);
  });
});
