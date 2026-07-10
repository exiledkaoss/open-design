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

describe('media config persistence', () => {
  it('preserves omitted providers on partial writes', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key', baseUrl: 'https://openai.test/v1' },
        volcengine: { apiKey: 'volc-key', baseUrl: 'https://volc.test' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { baseUrl: 'https://proxy.test/v1' },
      },
    });

    await expect(readStored(root)).resolves.toMatchObject({
      openai: { apiKey: 'openai-key', baseUrl: 'https://proxy.test/v1' },
      volcengine: { apiKey: 'volc-key', baseUrl: 'https://volc.test' },
    });
  });

  it('treats an empty force write as a no-op instead of wiping credentials', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key' },
        volcengine: { apiKey: 'volc-key' },
      },
    });

    await writeConfig(root, { providers: {}, force: true });

    await expect(readStored(root)).resolves.toMatchObject({
      openai: { apiKey: 'openai-key' },
      volcengine: { apiKey: 'volc-key' },
    });
  });

  it('clears only providers that are explicitly blanked', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key' },
        volcengine: { apiKey: 'volc-key' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
    });

    await expect(readStored(root)).resolves.toEqual({
      volcengine: { apiKey: 'volc-key' },
    });
  });

  it('stores provider credentials with owner-only permissions', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key' },
      },
    });

    const info = await stat(path.join(root, '.od', 'media-config.json'));
    expect(info.mode & 0o777).toBe(0o600);
  });
});
