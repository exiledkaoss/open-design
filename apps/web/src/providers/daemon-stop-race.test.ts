import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamViaDaemon } from './daemon';

describe('streamViaDaemon stop-during-create', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('cancels the created run and reports canceled instead of queued', async () => {
    const cancelController = new AbortController();
    const statuses: string[] = [];
    const createdIds: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/runs' && init?.method === 'POST') {
        // User hits Stop while create is in flight.
        cancelController.abort();
        return Response.json({ runId: 'run-stop-race' });
      }
      if (url === '/api/runs/run-stop-race/cancel' && init?.method === 'POST') {
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await streamViaDaemon({
      agentId: 'claude',
      history: [{ id: 'u1', role: 'user', content: 'hi' }],
      signal: new AbortController().signal,
      cancelSignal: cancelController.signal,
      handlers: {
        onDelta: () => {},
        onDone: () => {
          throw new Error('onDone should not run after cancel-during-create');
        },
        onError: () => {
          throw new Error('onError should not run after cancel-during-create');
        },
        onAgentEvent: () => {},
      },
      projectId: 'proj',
      conversationId: 'conv',
      assistantMessageId: 'a1',
      onRunCreated: (runId) => createdIds.push(runId),
      onRunStatus: (status) => statuses.push(status),
    });

    expect(createdIds).toEqual(['run-stop-race']);
    expect(statuses).toEqual(['canceled']);
    expect(statuses).not.toContain('queued');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/runs/run-stop-race/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
