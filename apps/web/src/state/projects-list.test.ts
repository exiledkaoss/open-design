import { afterEach, describe, expect, it, vi } from 'vitest';

import { listProjects } from './projects';

describe('listProjects', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the project array on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          projects: [{ id: 'p1', name: 'One', createdAt: 1, updatedAt: 1 }],
        }),
      ),
    );

    await expect(listProjects()).resolves.toEqual([
      { id: 'p1', name: 'One', createdAt: 1, updatedAt: 1 },
    ]);
  });

  it('returns null on non-OK responses so callers do not wipe UI state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    await expect(listProjects()).resolves.toBeNull();
  });

  it('returns null on network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(listProjects()).resolves.toBeNull();
  });
});
