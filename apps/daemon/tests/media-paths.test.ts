import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateMedia } from '../src/media.js';

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-paths-'));
  const projectRoot = path.join(root, 'workspace');
  const projectsRoot = path.join(projectRoot, '.od', 'projects');
  const projectId = 'project-1';
  const projectDir = path.join(projectsRoot, projectId);
  await mkdir(projectDir, { recursive: true });
  return { root, projectRoot, projectsRoot, projectId, projectDir };
}

async function createSymlink(target: string, link: string, type: 'file' | 'dir') {
  try {
    await symlink(target, link, type);
    return true;
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'EPERM'
    ) {
      return false;
    }
    throw err;
  }
}

describe('media path containment', () => {
  it('rejects reference images that symlink outside the project', async () => {
    const ws = await makeWorkspace();
    try {
      const outsideDir = path.join(ws.root, 'outside');
      await mkdir(outsideDir, { recursive: true });
      const outsideImage = path.join(outsideDir, 'secret.png');
      await writeFile(outsideImage, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const linkedImage = path.join(ws.projectDir, 'ref.png');
      if (!(await createSymlink(outsideImage, linkedImage, 'file'))) return;

      await expect(
        generateMedia({
          projectRoot: ws.projectRoot,
          projectsRoot: ws.projectsRoot,
          projectId: ws.projectId,
          surface: 'video',
          model: 'doubao-seedance-2-0-260128',
          image: 'ref.png',
          prompt: 'animate this',
        }),
      ).rejects.toThrow(/resolves outside the project directory/);
    } finally {
      await rm(ws.root, { recursive: true, force: true });
    }
  });

  it('rejects HyperFrames composition directories that symlink outside the project', async () => {
    const ws = await makeWorkspace();
    try {
      const outsideComposition = path.join(ws.root, 'outside-composition');
      await mkdir(outsideComposition, { recursive: true });
      await writeFile(path.join(outsideComposition, 'index.html'), '<!doctype html>');
      const cacheDir = path.join(ws.projectDir, '.hyperframes-cache');
      await mkdir(cacheDir, { recursive: true });
      if (
        !(await createSymlink(
          outsideComposition,
          path.join(cacheDir, 'linked'),
          'dir',
        ))
      ) {
        return;
      }

      await expect(
        generateMedia({
          projectRoot: ws.projectRoot,
          projectsRoot: ws.projectsRoot,
          projectId: ws.projectId,
          surface: 'video',
          model: 'hyperframes-html',
          compositionDir: '.hyperframes-cache/linked',
          prompt: 'render this',
        }),
      ).rejects.toThrow(/resolves outside the project directory/);
    } finally {
      await rm(ws.root, { recursive: true, force: true });
    }
  });
});
