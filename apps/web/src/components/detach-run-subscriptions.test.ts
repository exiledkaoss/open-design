import { describe, expect, it, vi } from 'vitest';

import { detachRunSubscriptions } from './detach-run-subscriptions';

describe('detachRunSubscriptions', () => {
  it('aborts stream controllers and clears streaming without aborting cancel controllers', () => {
    const streamA = new AbortController();
    const streamB = new AbortController();
    const cancelA = new AbortController();
    const cancelB = new AbortController();
    const abortController = new AbortController();
    const cancelController = new AbortController();
    const setStreaming = vi.fn();

    const reattachControllers = new Map([
      ['run-a', streamA],
      ['run-b', streamB],
    ]);
    const reattachCancelControllers = new Map([
      ['run-a', cancelA],
      ['run-b', cancelB],
    ]);

    const next = detachRunSubscriptions({
      reattachControllers,
      reattachCancelControllers,
      abortController,
      cancelController,
      setStreaming,
    });

    expect(streamA.signal.aborted).toBe(true);
    expect(streamB.signal.aborted).toBe(true);
    expect(abortController.signal.aborted).toBe(true);
    expect(cancelA.signal.aborted).toBe(false);
    expect(cancelB.signal.aborted).toBe(false);
    expect(cancelController.signal.aborted).toBe(false);
    expect(reattachControllers.size).toBe(0);
    expect(reattachCancelControllers.size).toBe(0);
    expect(setStreaming).toHaveBeenCalledWith(false);
    expect(next).toEqual({ abortController: null, cancelController: null });
  });
});
