import { access, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ensureProject,
  readProjectFile,
  writeProjectFile,
} from '../src/projects.js';

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-project-files-test-'));
  const projectsRoot = path.join(root, 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { root, projectsRoot, projectId, dir };
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe('project file containment', () => {
  it('rejects reads through project-local symlinks', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const secret = path.join(root, 'secret.txt');
    await writeFile(secret, 'do-not-read');
    await symlink(secret, path.join(dir, 'linked.txt'));

    await expect(readProjectFile(projectsRoot, projectId, 'linked.txt')).rejects.toThrow(
      /symlink/i,
    );
  });

  it('does not overwrite a symlink target outside the project', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const secret = path.join(root, 'secret.txt');
    await writeFile(secret, 'keep-me');
    await symlink(secret, path.join(dir, 'output.txt'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'output.txt', Buffer.from('pwned')),
    ).rejects.toThrow();

    await expect(readFile(secret, 'utf8')).resolves.toBe('keep-me');
  });

  it('rejects writes through symlinked parent directories', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    await symlink(outside, path.join(dir, 'assets'));

    await expect(
      writeProjectFile(projectsRoot, projectId, 'assets/pwned.txt', Buffer.from('pwned')),
    ).rejects.toThrow(/symlink/i);

    await expect(exists(path.join(outside, 'pwned.txt'))).resolves.toBe(false);
  });
});
