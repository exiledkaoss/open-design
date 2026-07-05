import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateMedia } from '../src/media.js';
import { ensureProject } from '../src/projects.js';

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-test-'));
  const projectId = 'p1';
  const projectsRoot = path.join(root, 'projects');
  const dir = await ensureProject(projectsRoot, projectId);
  return { dir, projectId, projectsRoot, root };
}

async function withMediaStubs<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.OD_MEDIA_ALLOW_STUBS;
  process.env.OD_MEDIA_ALLOW_STUBS = '1';
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.OD_MEDIA_ALLOW_STUBS;
    } else {
      process.env.OD_MEDIA_ALLOW_STUBS = previous;
    }
  }
}

describe('generateMedia path containment', () => {
  it('rejects --image symlinks that resolve outside the project', async () => {
    const { dir, projectId, projectsRoot, root } = await setupProject();
    const outsideImage = path.join(root, 'secret.png');
    await writeFile(outsideImage, 'not really a png');
    await symlink(outsideImage, path.join(dir, 'leak.png'));

    await withMediaStubs(async () => {
      await expect(
        generateMedia({
          image: 'leak.png',
          model: 'flux-1.1-pro',
          output: 'out.png',
          projectId,
          projectRoot: root,
          projectsRoot,
          prompt: 'test',
          surface: 'image',
        }),
      ).rejects.toThrow(/outside the project directory/);
    });
  });

  it('does not follow output symlinks when writing provider bytes', async () => {
    const { dir, projectId, projectsRoot, root } = await setupProject();
    const outsideTarget = path.join(root, 'outside.txt');
    await writeFile(outsideTarget, 'keep me');
    await symlink(outsideTarget, path.join(dir, 'render.png'));

    await withMediaStubs(async () => {
      await expect(
        generateMedia({
          model: 'flux-1.1-pro',
          output: 'render.png',
          projectId,
          projectRoot: root,
          projectsRoot,
          prompt: 'test',
          surface: 'image',
        }),
      ).rejects.toThrow(/symlink/);
    });

    await expect(readFile(outsideTarget, 'utf8')).resolves.toBe('keep me');
  });

  it('rejects HyperFrames composition symlinks that resolve outside the project', async () => {
    const { dir, projectId, projectsRoot, root } = await setupProject();
    const outsideComposition = path.join(root, 'outside-composition');
    await mkdir(outsideComposition);
    await symlink(outsideComposition, path.join(dir, 'composition-link'));

    await expect(
      generateMedia({
        compositionDir: 'composition-link',
        model: 'hyperframes-html',
        output: 'render.mp4',
        projectId,
        projectRoot: root,
        projectsRoot,
        prompt: 'test',
        surface: 'video',
      }),
    ).rejects.toThrow(/outside the project directory/);
  });
});
