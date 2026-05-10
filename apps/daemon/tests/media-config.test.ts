import { chmod, mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { writeConfig } from '../src/media-config.js';

describe('media provider config', () => {
  it('stores provider credentials in a user-only file', async () => {
    if (process.platform === 'win32') return;

    const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-config-test-'));
    const configPath = path.join(root, '.od', 'media-config.json');

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify({ providers: {} }), { mode: 0o644 });
    await chmod(configPath, 0o644);

    await writeConfig(root, {
      providers: {
        openai: {
          apiKey: 'sk-test',
          baseUrl: 'https://api.openai.com/v1',
        },
      },
    });

    const mode = (await stat(configPath)).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
