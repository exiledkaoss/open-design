import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  mediaConfigPath,
  readMaskedConfig,
  resolveProviderConfig,
  writeConfig,
} from '../src/media-config.js';

async function tempDataDir(prefix = 'od-media-config-') {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('media-config data directory', () => {
  it('writes credentials into the supplied dataDir, not <repo>/.od', async () => {
    const repoRoot = await tempDataDir('od-media-repo-');
    const dataDir = await tempDataDir('od-media-ns-');

    await writeConfig(dataDir, {
      providers: {
        openai: { apiKey: 'sk-namespace-a', baseUrl: '' },
      },
    });

    const namespaced = mediaConfigPath(dataDir);
    const leakedRepoPath = path.join(repoRoot, '.od', 'media-config.json');

    await expect(access(namespaced)).resolves.toBeUndefined();
    await expect(access(leakedRepoPath)).rejects.toMatchObject({ code: 'ENOENT' });

    const raw = JSON.parse(await readFile(namespaced, 'utf8'));
    expect(raw.providers.openai.apiKey).toBe('sk-namespace-a');
  });

  it('isolates provider keys across concurrent namespaces', async () => {
    const nsA = await tempDataDir('od-media-a-');
    const nsB = await tempDataDir('od-media-b-');

    await writeConfig(nsA, {
      providers: { openai: { apiKey: 'sk-aaa', baseUrl: '' } },
    });
    await writeConfig(nsB, {
      providers: { fal: { apiKey: 'fal-bbb', baseUrl: '' } },
    });

    const a = await resolveProviderConfig(nsA, 'openai');
    const bOpenAi = await resolveProviderConfig(nsB, 'openai');
    const bFal = await resolveProviderConfig(nsB, 'fal');

    expect(a.apiKey).toBe('sk-aaa');
    expect(bOpenAi.apiKey).toBe('');
    expect(bFal.apiKey).toBe('fal-bbb');

    const maskedA = await readMaskedConfig(nsA);
    const maskedB = await readMaskedConfig(nsB);
    expect(maskedA.providers).toMatchObject({
      openai: { configured: true },
      fal: { configured: false },
    });
    expect(maskedB.providers).toMatchObject({
      openai: { configured: false },
      fal: { configured: true },
    });
  });

  it('recovers from truncated media-config.json so PUT can save again', async () => {
    const dataDir = await tempDataDir('od-media-corrupt-');
    const file = mediaConfigPath(dataDir);
    await writeFile(file, '{', 'utf8');

    await expect(readMaskedConfig(dataDir)).resolves.toMatchObject({
      providers: expect.any(Object),
    });

    const published = await writeConfig(dataDir, {
      providers: { openai: { apiKey: 'sk-recovered', baseUrl: '' } },
    });
    expect(published.providers).toMatchObject({
      openai: { configured: true, apiKeyTail: 'ered' },
    });

    const raw = JSON.parse(await readFile(file, 'utf8'));
    expect(raw.providers.openai.apiKey).toBe('sk-recovered');
  });

  it('refuses empty wipe without force=true', async () => {
    const dataDir = await tempDataDir('od-media-wipe-');
    await writeConfig(dataDir, {
      providers: { openai: { apiKey: 'sk-keep', baseUrl: '' } },
    });

    await expect(writeConfig(dataDir, { providers: {} })).rejects.toMatchObject({
      status: 409,
    });

    const kept = await resolveProviderConfig(dataDir, 'openai');
    expect(kept.apiKey).toBe('sk-keep');
  });
});
