// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

import { createChatRunService } from '../src/runs.js';

describe('createChatRunService', () => {
  it('replays all retained run events after the previous 2000-event reconnect boundary', () => {
    const sent = [];
    const ended = vi.fn();
    const service = createChatRunService({
      createSseResponse: () => ({
        send(event, data, id) {
          sent.push({ event, data, id });
          return true;
        },
        end: ended,
        cleanup: vi.fn(),
      }),
      createSseErrorPayload: (code, message) => ({ error: { code, message } }),
    });
    const run = service.create();

    for (let i = 0; i < 2_005; i += 1) {
      service.emit(run, 'stdout', { chunk: `chunk-${i}` });
    }
    service.finish(run, 'succeeded', 0, null);

    service.stream(
      run,
      {
        get: () => undefined,
        query: { after: '0' },
      },
      {},
    );

    expect(sent).toHaveLength(2_006);
    expect(sent[0]).toEqual({ event: 'stdout', data: { chunk: 'chunk-0' }, id: 1 });
    expect(sent.at(-1)).toEqual({ event: 'end', data: { code: 0, signal: null, status: 'succeeded' }, id: 2_006 });
    expect(ended).toHaveBeenCalledOnce();
  });
});
