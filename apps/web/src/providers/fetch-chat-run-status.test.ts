import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchChatRunStatus } from './daemon';

describe('fetchChatRunStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns found when the run exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          id: 'run-1',
          projectId: 'p',
          conversationId: 'c',
          assistantMessageId: 'm',
          agentId: 'claude',
          status: 'running',
          createdAt: 1,
          updatedAt: 2,
        }),
      ),
    );

    await expect(fetchChatRunStatus('run-1')).resolves.toEqual({
      kind: 'found',
      run: expect.objectContaining({ id: 'run-1', status: 'running' }),
    });
  });

  it('returns missing on 404 so recovery can terminalize only gone runs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404 })));
    await expect(fetchChatRunStatus('run-1')).resolves.toEqual({ kind: 'missing' });
  });

  it('returns unavailable on transient HTTP and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })));
    await expect(fetchChatRunStatus('run-1')).resolves.toEqual({ kind: 'unavailable' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(fetchChatRunStatus('run-1')).resolves.toEqual({ kind: 'unavailable' });
  });
});
