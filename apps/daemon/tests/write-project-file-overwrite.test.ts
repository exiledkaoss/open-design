// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'vitest';

import { writeProjectFile } from '../src/projects.js';

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempProjectsRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-write-overwrite-'));
  tempDirs.push(dir);
  return dir;
}

test('overwrite:false refuses to clobber an existing project file', async () => {
  const root = tempProjectsRoot();
  await writeProjectFile(root, 'proj', 'dashboard.html', Buffer.from('<p>agent</p>'));

  await assert.rejects(
    () =>
      writeProjectFile(root, 'proj', 'dashboard.html', Buffer.from('<p>artifact</p>'), {
        overwrite: false,
      }),
    (err) => err && err.code === 'FILE_EXISTS',
  );

  const onDisk = fs.readFileSync(path.join(root, 'proj', 'dashboard.html'), 'utf8');
  assert.equal(onDisk, '<p>agent</p>');
});

test('overwrite:true (default) still replaces content', async () => {
  const root = tempProjectsRoot();
  await writeProjectFile(root, 'proj', 'page.html', Buffer.from('v1'));
  await writeProjectFile(root, 'proj', 'page.html', Buffer.from('v2'));
  const onDisk = fs.readFileSync(path.join(root, 'proj', 'page.html'), 'utf8');
  assert.equal(onDisk, 'v2');
});
