import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  deleteProjectFile,
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
    const outside = path.join(root, 'secret.txt');
    await writeFile(outside, 'secret');
    await symlink(outside, path.join(dir, 'leak.txt'));

    await expect(readProjectFile(projectsRoot, projectId, 'leak.txt')).rejects.toThrow(
      /symlink/i,
    );
  });

  it('does not overwrite an outside file through a project symlink', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(root, 'outside.txt');
    await writeFile(outside, 'keep');
    await symlink(outside, path.join(dir, 'result.txt'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'result.txt', Buffer.from('pwned')),
    ).rejects.toMatchObject({ code: 'ELOOP' });
    await expect(readFile(outside, 'utf8')).resolves.toBe('keep');
  });

  it('does not write through symlinked parent directories', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outsideDir = path.join(root, 'outside-dir');
    await mkdir(outsideDir);
    await symlink(outsideDir, path.join(dir, 'linked-dir'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'linked-dir/result.txt', Buffer.from('pwned')),
    ).rejects.toThrow(/symlink/i);
    await expect(readFile(path.join(outsideDir, 'result.txt'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects deletes through project symlinks', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(root, 'delete-target.txt');
    await writeFile(outside, 'keep');
    await symlink(outside, path.join(dir, 'delete-me.txt'));

    await expect(deleteProjectFile(projectsRoot, projectId, 'delete-me.txt')).rejects.toThrow(
      /symlink/i,
    );
    await expect(readFile(outside, 'utf8')).resolves.toBe('keep');
  });
});
