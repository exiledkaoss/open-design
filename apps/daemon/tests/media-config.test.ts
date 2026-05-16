import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeConfig } from '../src/media-config.js';

let roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-config-'));
  roots.push(root);
  return root;
}

async function writeStored(root: string, providers: Record<string, { apiKey?: string; baseUrl?: string }>) {
  const file = path.join(root, '.od', 'media-config.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ providers }, null, 2), 'utf8');
}

async function readStored(root: string) {
  const raw = await readFile(path.join(root, '.od', 'media-config.json'), 'utf8');
  return JSON.parse(raw).providers;
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

describe('writeConfig', () => {
  it('preserves stored providers omitted from a browser sync payload', async () => {
    const root = await tempRoot();
    await writeStored(root, {
      openai: { apiKey: 'openai-key', baseUrl: 'https://openai.example/v1' },
      bfl: { apiKey: 'bfl-key' },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'new-openai-key', baseUrl: 'https://openai.example/v2' },
      },
      force: true,
    });

    await expect(readStored(root)).resolves.toEqual({
      openai: { apiKey: 'new-openai-key', baseUrl: 'https://openai.example/v2' },
      bfl: { apiKey: 'bfl-key' },
    });
  });

  it('deletes only providers sent as explicit empty entries', async () => {
    const root = await tempRoot();
    await writeStored(root, {
      openai: { apiKey: 'openai-key' },
      bfl: { apiKey: 'bfl-key' },
    });

    await writeConfig(root, {
      providers: {
        openai: { apiKey: '', baseUrl: '' },
      },
      force: true,
    });

    await expect(readStored(root)).resolves.toEqual({
      bfl: { apiKey: 'bfl-key' },
    });
  });

  it('writes credential files with owner-only permissions on POSIX', async () => {
    if (process.platform === 'win32') return;
    const root = await tempRoot();

    await writeConfig(root, {
      providers: {
        openai: { apiKey: 'openai-key', baseUrl: '' },
      },
    });

    const mode = (await stat(path.join(root, '.od', 'media-config.json'))).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
