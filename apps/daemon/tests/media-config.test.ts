import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { writeConfig } from '../src/media-config.js';

async function setupRoot() {
  return await mkdtemp(path.join(os.tmpdir(), 'od-media-config-test-'));
}

async function readStoredProviders(projectRoot: string) {
  const raw = await readFile(path.join(projectRoot, '.od', 'media-config.json'), 'utf8');
  return JSON.parse(raw).providers;
}

describe('media provider config persistence', () => {
  it('preserves omitted providers when saving a partial provider map', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key', baseUrl: 'https://openai.example' },
        volcengine: { apiKey: 'volc-key', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      force: true,
      providers: {
        openai: { apiKey: 'new-openai-key', baseUrl: 'https://openai.example' },
      },
    });

    await expect(readStoredProviders(root)).resolves.toEqual({
      openai: { apiKey: 'new-openai-key', baseUrl: 'https://openai.example' },
      volcengine: { apiKey: 'volc-key', baseUrl: '' },
    });
  });

  it('deletes only providers that are explicitly saved empty', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key', baseUrl: '' },
        volcengine: { apiKey: 'volc-key', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      force: true,
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
    });

    await expect(readStoredProviders(root)).resolves.toEqual({
      volcengine: { apiKey: 'volc-key', baseUrl: '' },
    });
  });

  it('writes stored provider credentials with owner-only permissions', async () => {
    const root = await setupRoot();

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key', baseUrl: '' },
      },
    });

    const info = await stat(path.join(root, '.od', 'media-config.json'));
    expect(info.mode & 0o777).toBe(0o600);
  });
});
