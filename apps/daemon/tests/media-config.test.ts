import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveProviderConfig, writeConfig } from '../src/media-config.js';

async function createProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'od-media-config-'));
}

describe('media config persistence', () => {
  it('preserves omitted provider credentials when applying a partial update', async () => {
    const root = await createProjectRoot();

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai-old', baseUrl: 'https://old.example' },
        volcengine: { apiKey: 'volcengine-key', baseUrl: '' },
      },
    });
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai-new', baseUrl: 'https://new.example' },
      },
    });

    await expect(resolveProviderConfig(root, 'openai')).resolves.toEqual({
      apiKey: 'sk-openai-new',
      baseUrl: 'https://new.example',
    });
    await expect(resolveProviderConfig(root, 'volcengine')).resolves.toEqual({
      apiKey: 'volcengine-key',
      baseUrl: '',
    });
  });

  it('deletes only providers sent with an explicit empty entry', async () => {
    const root = await createProjectRoot();

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: '' },
        volcengine: { apiKey: 'volcengine-key', baseUrl: '' },
      },
    });
    await writeConfig(root, {
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
    });

    await expect(resolveProviderConfig(root, 'openai')).resolves.toEqual({
      apiKey: '',
      baseUrl: '',
    });
    await expect(resolveProviderConfig(root, 'volcengine')).resolves.toEqual({
      apiKey: 'volcengine-key',
      baseUrl: '',
    });
  });

  it('stores provider credentials in a private file on POSIX systems', async () => {
    const root = await createProjectRoot();

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: '' },
      },
    });

    if (process.platform !== 'win32') {
      const metadata = await stat(path.join(root, '.od', 'media-config.json'));
      expect(metadata.mode & 0o777).toBe(0o600);
    }
  });
});
