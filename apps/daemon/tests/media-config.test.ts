// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'vitest';

import { writeConfig } from '../src/media-config.js';

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createProjectRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-media-config-'));
  tempDirs.push(dir);
  return dir;
}

test('stores media provider credentials in a private config file', async () => {
  const projectRoot = createProjectRoot();

  await writeConfig(projectRoot, {
    providers: {
      openai: {
        apiKey: 'sk-test-secret',
        baseUrl: 'https://api.openai.com/v1',
      },
    },
  });

  const configPath = path.join(projectRoot, '.od', 'media-config.json');
  const mode = fs.statSync(configPath).mode & 0o777;
  assert.equal(mode, 0o600);
});
