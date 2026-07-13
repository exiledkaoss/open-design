import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readMaskedConfig,
  resolveProviderConfig,
  writeConfig,
} from '../src/media-config.js';

async function setupRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'od-media-config-test-'));
}

const MEDIA_ENV_KEYS = [
  'OD_OPENAI_API_KEY',
  'OPENAI_API_KEY',
  'AZURE_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'OD_VOLCENGINE_API_KEY',
  'ARK_API_KEY',
  'VOLCENGINE_API_KEY',
];

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of MEDIA_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MEDIA_ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe('media provider config', () => {
  it('preserves omitted providers when saving a provider subset', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-secret', baseUrl: 'https://openai.test/v1' },
        volcengine: { apiKey: 'volc-secret', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-new', baseUrl: 'https://openai.test/v2' },
      },
      force: true,
    });

    await expect(resolveProviderConfig(root, 'openai')).resolves.toEqual({
      apiKey: 'openai-new',
      baseUrl: 'https://openai.test/v2',
    });
    await expect(resolveProviderConfig(root, 'volcengine')).resolves.toEqual({
      apiKey: 'volc-secret',
      baseUrl: '',
    });
  });

  it('only deletes providers with explicit blank entries', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-secret', baseUrl: '' },
        volcengine: { apiKey: 'volc-secret', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
    });

    const masked = await readMaskedConfig(root);
    expect(masked.providers.openai.configured).toBe(false);
    expect(masked.providers.volcengine.configured).toBe(true);
  });

  it('stores provider credentials in an owner-only file', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-secret', baseUrl: '' },
      },
    });

    const info = await stat(path.join(root, '.od', 'media-config.json'));
    expect(info.mode & 0o777).toBe(0o600);
  });
});
