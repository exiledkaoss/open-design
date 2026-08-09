import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchProjectFileText,
  listProjectFileNames,
  ProjectFileExistsError,
  writeProjectTextFile,
} from './registry';

describe('listProjectFileNames', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns names on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          files: [
            { name: 'dashboard.html', size: 1, mtime: 1, kind: 'html', mime: 'text/html' },
            { name: 'notes.md', size: 1, mtime: 1, kind: 'text', mime: 'text/markdown' },
          ],
        }),
      ),
    );
    await expect(listProjectFileNames('proj')).resolves.toEqual(['dashboard.html', 'notes.md']);
  });

  it('returns null on HTTP failure instead of pretending the project is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    await expect(listProjectFileNames('proj')).resolves.toBeNull();
  });
});

describe('writeProjectTextFile overwrite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends overwrite:false and surfaces 409 as ProjectFileExistsError', async () => {
    const fetchMock = vi.fn(async () => new Response('exists', { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      writeProjectTextFile('proj', 'dashboard.html', '<p>x</p>', { overwrite: false }),
    ).rejects.toBeInstanceOf(ProjectFileExistsError);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/proj/files',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'dashboard.html',
          content: '<p>x</p>',
          artifactManifest: undefined,
          overwrite: false,
        }),
      }),
    );
  });
});

describe('fetchProjectFileText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('can bypass caches when fetching source text', async () => {
    const fetchMock = vi.fn(async () => new Response('<svg />', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchProjectFileText('project-1', 'diagram.svg', {
        cache: 'no-store',
        cacheBustKey: '1710000000-2',
      }),
    ).resolves.toBe('<svg />');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/raw/diagram.svg?cacheBust=1710000000-2',
      { cache: 'no-store' },
    );
  });

  it('logs HTTP failure context before returning null', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404, statusText: 'Not Found' })));

    await expect(fetchProjectFileText('project-1', 'missing.svg')).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith(
      '[fetchProjectFileText] failed:',
      expect.objectContaining({
        name: 'missing.svg',
        projectId: 'project-1',
        status: 404,
        statusText: 'Not Found',
        url: '/api/projects/project-1/raw/missing.svg',
      }),
    );
  });

  it('logs thrown fetch errors before returning null', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('network down');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw error;
    }));

    await expect(fetchProjectFileText('project-1', 'diagram.svg')).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith(
      '[fetchProjectFileText] failed:',
      expect.objectContaining({
        error,
        name: 'diagram.svg',
        projectId: 'project-1',
        url: '/api/projects/project-1/raw/diagram.svg',
      }),
    );
  });
});
