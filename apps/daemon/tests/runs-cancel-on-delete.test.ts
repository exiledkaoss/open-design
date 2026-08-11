import { describe, expect, it, vi } from 'vitest';
import { createChatRunService } from '../src/runs.js';

type MutableRun = {
  cancelRequested: boolean;
  child: { killed: boolean; kill: ReturnType<typeof vi.fn> } | null;
};

describe('cancel active runs for deleted project/conversation', () => {
  function makeService() {
    return createChatRunService({
      createSseResponse: () => ({
        send() {},
        end() {},
        cleanup() {},
      }),
      createSseErrorPayload: (code: string, message: string) => ({ code, message }),
    });
  }

  it('cancels active runs scoped to a conversation id', () => {
    const runs = makeService();
    const target = runs.create({ projectId: 'p1', conversationId: 'c1' }) as MutableRun;
    const other = runs.create({ projectId: 'p1', conversationId: 'c2' }) as MutableRun;
    // Simulate a live child so cancel requests SIGTERM instead of finish().
    const targetChild = { killed: false, kill: vi.fn() };
    const otherChild = { killed: false, kill: vi.fn() };
    target.child = targetChild;
    other.child = otherChild;

    for (const run of runs.list({ conversationId: 'c1', status: 'active' })) {
      runs.cancel(run);
    }

    expect(target.cancelRequested).toBe(true);
    expect(targetChild.kill).toHaveBeenCalledWith('SIGTERM');
    expect(other.cancelRequested).toBe(false);
    expect(otherChild.kill).not.toHaveBeenCalled();
  });

  it('cancels active runs scoped to a project id', () => {
    const runs = makeService();
    const target = runs.create({ projectId: 'p1', conversationId: 'c1' }) as MutableRun;
    const other = runs.create({ projectId: 'p2', conversationId: 'c9' }) as MutableRun;
    const targetChild = { killed: false, kill: vi.fn() };
    const otherChild = { killed: false, kill: vi.fn() };
    target.child = targetChild;
    other.child = otherChild;

    for (const run of runs.list({ projectId: 'p1', status: 'active' })) {
      runs.cancel(run);
    }

    expect(target.cancelRequested).toBe(true);
    expect(targetChild.kill).toHaveBeenCalledWith('SIGTERM');
    expect(other.cancelRequested).toBe(false);
    expect(otherChild.kill).not.toHaveBeenCalled();
  });
});
