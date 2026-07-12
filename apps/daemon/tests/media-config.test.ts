import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveProviderConfig, writeConfig } from '../src/media-config.js';

async function setupRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'od-media-config-test-'));
}

describe('media provider config persistence', () => {
  it('preserves omitted providers when patching one provider', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: 'https://api.openai.com/v1' },
        volcengine: { apiKey: 'volc-key', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai-2', baseUrl: 'https://azure.example/openai' },
      },
      force: true,
    });

    await expect(resolveProviderConfig(root, 'volcengine')).resolves.toMatchObject({
      apiKey: 'volc-key',
    });
    await expect(resolveProviderConfig(root, 'openai')).resolves.toMatchObject({
      apiKey: 'sk-openai-2',
      baseUrl: 'https://azure.example/openai',
    });
  });

  it('does not wipe saved providers for an empty forced payload', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: '' },
      },
    });

    await writeConfig(root, { providers: {}, force: true });

    await expect(resolveProviderConfig(root, 'openai')).resolves.toMatchObject({
      apiKey: 'sk-openai',
    });
  });

  it('clears only the provider with an explicit blank entry', async () => {
    const root = await setupRoot();
    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'sk-openai', baseUrl: '' },
        volcengine: { apiKey: 'volc-key', baseUrl: '' },
      },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
      force: true,
    });

    await expect(resolveProviderConfig(root, 'openai')).resolves.toMatchObject({
      apiKey: '',
    });
    await expect(resolveProviderConfig(root, 'volcengine')).resolves.toMatchObject({
      apiKey: 'volc-key',
    });
  });

  it('stores provider credentials with owner-only permissions where supported', async () => {
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
