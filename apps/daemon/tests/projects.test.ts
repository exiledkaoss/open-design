import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ensureProject, readProjectFile, writeProjectFile } from '../src/projects.js';

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-project-test-'));
  const projectId = 'p1';
  const projectsRoot = path.join(root, 'projects');
  const dir = await ensureProject(projectsRoot, projectId);
  return { dir, projectId, projectsRoot };
}

describe('project file symlink safety', () => {
  it('rejects project-local symlinks when reading files', async () => {
    const { dir, projectId, projectsRoot } = await setupProject();
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'od-project-secret-'));
    const outsideFile = path.join(outsideDir, 'secret.txt');
    await writeFile(outsideFile, 'secret');
    await symlink(outsideFile, path.join(dir, 'linked.txt'));

    await expect(readProjectFile(projectsRoot, projectId, 'linked.txt')).rejects.toThrow(
      /symlink/,
    );
  });

  it('does not follow project-local symlinks when writing files', async () => {
    const { dir, projectId, projectsRoot } = await setupProject();
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'od-project-secret-'));
    const outsideFile = path.join(outsideDir, 'secret.txt');
    await writeFile(outsideFile, 'secret');
    await symlink(outsideFile, path.join(dir, 'linked.txt'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'linked.txt', Buffer.from('overwritten')),
    ).rejects.toThrow(/symlink/);
    await expect(readFile(outsideFile, 'utf8')).resolves.toBe('secret');
  });
});
