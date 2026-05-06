import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readMaskedConfig, writeConfig } from '../src/media-config.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'od-media-config-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('media config persistence', () => {
  it('stores provider config directly under the configured data directory', async () => {
    const dataDir = await makeTempDir();

    await writeConfig(dataDir, {
      providers: {
        openai: {
          apiKey: 'sk-test-key',
          baseUrl: 'https://example.test/v1',
        },
      },
    });

    const stored = JSON.parse(await readFile(path.join(dataDir, 'media-config.json'), 'utf8'));
    expect(stored.providers.openai).toEqual({
      apiKey: 'sk-test-key',
      baseUrl: 'https://example.test/v1',
    });
    await expect(readFile(path.join(dataDir, '.od', 'media-config.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('reads provider config from the same data directory', async () => {
    const dataDir = await makeTempDir();

    await writeConfig(dataDir, {
      providers: {
        openai: {
          apiKey: 'sk-test-key',
          baseUrl: 'https://example.test/v1',
        },
      },
    });

    await expect(readMaskedConfig(dataDir)).resolves.toMatchObject({
      providers: {
        openai: {
          apiKeyTail: '-key',
          baseUrl: 'https://example.test/v1',
          configured: true,
          source: 'stored',
        },
      },
    });
  });
});
