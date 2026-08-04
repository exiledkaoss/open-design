import { describe, expect, it, vi } from 'vitest';
import { detachRunSubscriptions } from './detach-run-subscriptions';

describe('detachRunSubscriptions', () => {
  it('aborts stream controllers and clears streaming without canceling runs', () => {
    const streamA = new AbortController();
    const streamB = new AbortController();
    const liveStream = new AbortController();
    const cancelA = new AbortController();
    const liveCancel = new AbortController();
    const reattachControllers = new Map<string, AbortController>([
      ['run-a', streamA],
      ['run-b', streamB],
    ]);
    const reattachCancelControllers = new Map<string, AbortController>([
      ['run-a', cancelA],
    ]);
    const setStreaming = vi.fn();

    const next = detachRunSubscriptions({
      reattachControllers,
      reattachCancelControllers,
      abortController: liveStream,
      cancelController: liveCancel,
      setStreaming,
    });

    expect(streamA.signal.aborted).toBe(true);
    expect(streamB.signal.aborted).toBe(true);
    expect(liveStream.signal.aborted).toBe(true);
    expect(cancelA.signal.aborted).toBe(false);
    expect(liveCancel.signal.aborted).toBe(false);
    expect(reattachControllers.size).toBe(0);
    expect(reattachCancelControllers.size).toBe(0);
    expect(setStreaming).toHaveBeenCalledWith(false);
    expect(next).toEqual({ abortController: null, cancelController: null });
  });
});
