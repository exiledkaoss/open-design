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

function configPath(projectRoot) {
  return path.join(projectRoot, '.od', 'media-config.json');
}

function readStored(projectRoot) {
  return JSON.parse(fs.readFileSync(configPath(projectRoot), 'utf8'));
}

test('preserves stored media credentials when a save omits providers', async () => {
  const projectRoot = createProjectRoot();
  await writeConfig(projectRoot, {
    providers: {
      openai: {
        apiKey: 'sk-existing',
        baseUrl: 'https://api.openai.test/v1',
      },
      volcengine: {
        apiKey: 'volc-existing',
        baseUrl: '',
      },
    },
  });

  await writeConfig(projectRoot, { providers: {}, force: true });

  assert.deepEqual(readStored(projectRoot), {
    providers: {
      openai: {
        apiKey: 'sk-existing',
        baseUrl: 'https://api.openai.test/v1',
      },
      volcengine: {
        apiKey: 'volc-existing',
        baseUrl: '',
      },
    },
  });
});

test('clears a stored media provider only when explicitly supplied empty', async () => {
  const projectRoot = createProjectRoot();
  await writeConfig(projectRoot, {
    providers: {
      openai: { apiKey: 'sk-existing', baseUrl: '' },
      volcengine: { apiKey: 'volc-existing', baseUrl: '' },
    },
  });

  await writeConfig(projectRoot, {
    providers: {
      openai: { apiKey: '', baseUrl: '' },
    },
  });

  assert.deepEqual(readStored(projectRoot), {
    providers: {
      volcengine: { apiKey: 'volc-existing', baseUrl: '' },
    },
  });
});

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

  const mode = fs.statSync(configPath(projectRoot)).mode & 0o777;
  assert.equal(mode, 0o600);
});
