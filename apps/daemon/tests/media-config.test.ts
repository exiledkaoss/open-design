import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readMaskedConfig, writeConfig } from '../src/media-config.js';

async function setupRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'od-media-config-test-'));
}

async function readStored(root: string) {
  const raw = await readFile(path.join(root, '.od', 'media-config.json'), 'utf8');
  return JSON.parse(raw) as {
    providers: Record<string, { apiKey?: string; baseUrl?: string }>;
  };
}

describe('media config persistence', () => {
  it('preserves stored provider credentials when a save omits them', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-existing', baseUrl: 'https://api.openai.test/v1' },
      },
    });

    await writeConfig(root, { providers: {} });

    await expect(readStored(root)).resolves.toEqual({
      providers: {
        openai: { apiKey: 'sk-existing', baseUrl: 'https://api.openai.test/v1' },
      },
    });
    await expect(readMaskedConfig(root)).resolves.toMatchObject({
      providers: {
        openai: {
          configured: true,
          source: 'stored',
          apiKeyTail: 'ting',
        },
      },
    });
  });

  it('clears a provider only when it is explicitly supplied empty', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-existing', baseUrl: 'https://api.openai.test/v1' },
        volcengine: { apiKey: 'volc-key', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
    });

    await expect(readStored(root)).resolves.toEqual({
      providers: {
        volcengine: { apiKey: 'volc-key', baseUrl: '' },
      },
    });
  });
});
