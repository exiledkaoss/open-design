import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ensureProject,
  projectDir,
  writeProjectFile,
} from '../src/projects.js';

async function setupRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-project-id-'));
  const projectsRoot = path.join(root, 'projects');
  await mkdir(projectsRoot, { recursive: true });
  await writeFile(path.join(root, 'app.sqlite'), 'SECRET_DB');
  return { root, projectsRoot };
}

describe('project id containment', () => {
  it('rejects `.` and `..` so they cannot resolve to projects root or parent', async () => {
    const { projectsRoot } = await setupRoot();

    expect(() => projectDir(projectsRoot, '.')).toThrow(/invalid project id/);
    expect(() => projectDir(projectsRoot, '..')).toThrow(/invalid project id/);
    await expect(ensureProject(projectsRoot, '.')).rejects.toThrow(/invalid project id/);
    await expect(ensureProject(projectsRoot, '..')).rejects.toThrow(/invalid project id/);
  });

  it('rejects leading-dot ids that the old regex treated as safe', async () => {
    const { projectsRoot } = await setupRoot();
    expect(() => projectDir(projectsRoot, '.hidden')).toThrow(/invalid project id/);
    expect(() => projectDir(projectsRoot, '..foo')).toThrow(/invalid project id/);
  });

  it('keeps normal ids under the projects root', async () => {
    const { projectsRoot } = await setupRoot();
    const dir = await ensureProject(projectsRoot, 'proj-1');
    expect(dir).toBe(path.join(projectsRoot, 'proj-1'));
    expect(dir.startsWith(projectsRoot + path.sep)).toBe(true);
  });

  it('cannot overwrite sibling data-dir files via project id `..`', async () => {
    const { root, projectsRoot } = await setupRoot();

    await expect(
      writeProjectFile(projectsRoot, '..', 'app.sqlite', Buffer.from('PWNED')),
    ).rejects.toThrow(/invalid project id/);

    expect(await readFile(path.join(root, 'app.sqlite'), 'utf8')).toBe('SECRET_DB');
  });
});
