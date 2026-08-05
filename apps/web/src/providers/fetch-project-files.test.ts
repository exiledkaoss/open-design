import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchProjectFiles } from './registry';

describe('fetchProjectFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the file array on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          files: [
            {
              name: 'a.html',
              path: 'a.html',
              type: 'file',
              size: 1,
              mtime: 1,
              kind: 'html',
              mime: 'text/html',
            },
          ],
        }),
      ),
    );

    const files = await fetchProjectFiles('project-1');
    expect(files).toHaveLength(1);
    expect(files?.[0]?.name).toBe('a.html');
  });

  it('returns null on non-OK responses so callers do not treat the folder as empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 502 })));
    await expect(fetchProjectFiles('project-1')).resolves.toBeNull();
  });

  it('returns null on network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(fetchProjectFiles('project-1')).resolves.toBeNull();
  });
});
