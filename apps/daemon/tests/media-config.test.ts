import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { writeConfig } from '../src/media-config.js';

async function setupRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'od-media-config-test-'));
}

async function readStored(root: string) {
  const raw = await readFile(path.join(root, '.od', 'media-config.json'), 'utf8');
  return JSON.parse(raw).providers;
}

describe('media provider config persistence', () => {
  it('preserves omitted providers on partial saves', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: 'https://openai.test/v1' },
        fal: { apiKey: 'fal-key', baseUrl: 'https://fal.test' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { baseUrl: 'https://azure.test/openai' },
      },
    });

    await expect(readStored(root)).resolves.toEqual({
      openai: { apiKey: 'sk-openai', baseUrl: 'https://azure.test/openai' },
      fal: { apiKey: 'fal-key', baseUrl: 'https://fal.test' },
    });
  });

  it('does not wipe stored providers when the incoming map is empty', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: '' },
      },
    });

    await writeConfig(root, { providers: {} });

    await expect(readStored(root)).resolves.toEqual({
      openai: { apiKey: 'sk-openai', baseUrl: '' },
    });
  });

  it('deletes only the provider sent as an explicit blank entry', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: '' },
        fal: { apiKey: 'fal-key', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
    });

    await expect(readStored(root)).resolves.toEqual({
      fal: { apiKey: 'fal-key', baseUrl: '' },
    });
  });

  it('stores provider credentials with owner-only permissions', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: '' },
      },
    });

    const info = await stat(path.join(root, '.od', 'media-config.json'));
    expect(info.mode & 0o777).toBe(0o600);
  });
});
