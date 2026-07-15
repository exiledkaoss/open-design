import { describe, expect, it } from 'vitest';

import { detachRunSubscriptions } from './run-subscriptions';

describe('detachRunSubscriptions', () => {
  it('closes event streams without canceling daemon runs', () => {
    const activeStream = new AbortController();
    const reattachedStream = new AbortController();
    const cancelController = new AbortController();
    const streamControllers = new Map([['run-1', reattachedStream]]);
    const cancelControllers = new Map([['run-1', cancelController]]);

    detachRunSubscriptions({
      activeStream,
      streamControllers,
      cancelControllers,
    });

    expect(activeStream.signal.aborted).toBe(true);
    expect(reattachedStream.signal.aborted).toBe(true);
    expect(cancelController.signal.aborted).toBe(false);
    expect(streamControllers.size).toBe(0);
    expect(cancelControllers.size).toBe(0);
  });
});
