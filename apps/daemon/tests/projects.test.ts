import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ensureProject,
  readProjectFile,
  writeProjectFile,
} from '../src/projects.js';

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-projects-test-'));
  const projectsRoot = path.join(root, 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { root, projectsRoot, projectId, dir };
}

describe('project file containment', () => {
  it('rejects reads through project symlinks', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const secret = path.join(root, 'secret.png');
    await writeFile(secret, 'not a project file');
    await symlink(secret, path.join(dir, 'leak.png'));

    await expect(readProjectFile(projectsRoot, projectId, 'leak.png')).rejects.toThrow(
      /symlink/i,
    );
  });

  it('rejects writes through symlinked parent directories', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    const outsideFile = path.join(outside, 'owned.txt');
    await writeFile(outsideFile, 'keep');
    await symlink(outside, path.join(dir, 'linked-dir'), 'dir');

    await expect(
      writeProjectFile(projectsRoot, projectId, 'linked-dir/owned.txt', Buffer.from('overwrite')),
    ).rejects.toThrow(/symlink/i);
    await expect(readFile(outsideFile, 'utf8')).resolves.toBe('keep');
  });
});
