// @ts-nocheck
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import { createChatRunService } from '../src/runs.js';

describe('createChatRunService', () => {
  it('replays every event from a long run after a disconnect', () => {
    const replayed = [];
    const service = createChatRunService({
      createSseResponse: () => ({
        send(event, data, id) {
          replayed.push({ event, data, id });
        },
        end() {},
        cleanup() {},
      }),
      createSseErrorPayload: (code, message) => ({ code, message }),
    });
    const run = service.create();

    for (let index = 1; index <= 2_500; index += 1) {
      service.emit(run, 'stdout', { chunk: String(index) });
    }
    service.finish(run, 'succeeded', 0);

    service.stream(
      run,
      {
        get: () => '',
        query: { after: '0' },
      },
      new EventEmitter(),
    );

    expect(replayed).toHaveLength(2_501);
    expect(replayed[0]).toEqual({
      event: 'stdout',
      data: { chunk: '1' },
      id: 1,
    });
    expect(replayed.at(-1)).toEqual({
      event: 'end',
      data: { code: 0, signal: null, status: 'succeeded' },
      id: 2_501,
    });
  });
});
