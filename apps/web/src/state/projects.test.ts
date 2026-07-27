import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveMessage } from './projects';

describe('saveMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('throws when the daemon rejects the persistence request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('request entity too large', { status: 413 })),
    );

    await expect(
      saveMessage('project-1', 'conversation-1', {
        id: 'message-1',
        role: 'assistant',
        content: 'x'.repeat(100),
      }),
    ).rejects.toThrow(/Failed to save message \(413\).*request entity too large/);
  });

  it('resolves when the daemon accepts the message', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: { id: 'message-1' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      saveMessage('project-1', 'conversation-1', {
        id: 'message-1',
        role: 'assistant',
        content: 'hello',
      }),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/conversations/conversation-1/messages/message-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
