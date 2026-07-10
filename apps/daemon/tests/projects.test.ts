import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ensureProject, readProjectFile, writeProjectFile } from '../src/projects.js';

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-projects-test-'));
  const projectsRoot = path.join(root, 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { root, projectsRoot, projectId, dir };
}

describe('project file containment', () => {
  it('rejects reads through project-local symlink directories', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'secret.txt'), 'secret');
    await symlink(outside, path.join(dir, 'assets'));

    await expect(
      readProjectFile(projectsRoot, projectId, 'assets/secret.txt'),
    ).rejects.toThrow(/symlink/i);
  });

  it('rejects writes through project-local symlink directories', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    await symlink(outside, path.join(dir, 'assets'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'assets/pwned.txt', Buffer.from('pwned')),
    ).rejects.toThrow(/symlink/i);

    await expect(readFile(path.join(outside, 'pwned.txt'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects overwriting a final symlink target outside the project', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outsideFile = path.join(root, 'outside.txt');
    await writeFile(outsideFile, 'keep');
    await symlink(outsideFile, path.join(dir, 'image.png'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'image.png', Buffer.from('replace')),
    ).rejects.toThrow(/symlink/i);
    await expect(readFile(outsideFile, 'utf8')).resolves.toBe('keep');
  });
});
