import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
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
});

describe('project file symlink containment', () => {
  it('rejects reads through project-local symlinks', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const secretPath = path.join(root, 'secret.txt');
    await writeFile(secretPath, 'secret-token');
    await symlink(secretPath, path.join(dir, 'leak.txt'));

    await expect(readProjectFile(projectsRoot, projectId, 'leak.txt')).rejects.toThrow(
      /symlinks are not allowed/,
    );
  });

  it('rejects writes through project-local symlinks without changing the target', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const secretPath = path.join(root, 'media-config.json');
    await writeFile(secretPath, '{"apiKey":"real"}');
    await symlink(secretPath, path.join(dir, 'media-config.json'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'media-config.json', Buffer.from('{}')),
    ).rejects.toThrow(/symlinks are not allowed/);
    await expect(readFile(secretPath, 'utf8')).resolves.toBe('{"apiKey":"real"}');
  });
}
