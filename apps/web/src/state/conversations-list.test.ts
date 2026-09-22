import { afterEach, describe, expect, it, vi } from 'vitest';

import { listConversations, listMessages } from './projects';

describe('listConversations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the conversation array on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          conversations: [
            { id: 'c1', projectId: 'p1', title: null, createdAt: 1, updatedAt: 1 },
          ],
        }),
      ),
    );

    await expect(listConversations('p1')).resolves.toEqual([
      { id: 'c1', projectId: 'p1', title: null, createdAt: 1, updatedAt: 1 },
    ]);
  });

  it('returns null on non-OK responses so callers do not seed a spurious conversation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    await expect(listConversations('p1')).resolves.toBeNull();
  });

  it('returns null on network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(listConversations('p1')).resolves.toBeNull();
  });
});

describe('listMessages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the message array on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          messages: [{ id: 'm1', role: 'user', content: 'hi' }],
        }),
      ),
    );

    await expect(listMessages('p1', 'c1')).resolves.toEqual([
      { id: 'm1', role: 'user', content: 'hi' },
    ]);
  });

  it('returns null on non-OK responses so callers do not pretend the chat is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    await expect(listMessages('p1', 'c1')).resolves.toBeNull();
  });

  it('returns null on network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(listMessages('p1', 'c1')).resolves.toBeNull();
  });
});
