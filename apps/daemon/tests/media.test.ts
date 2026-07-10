import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateMedia } from '../src/media.js';
import { ensureProject } from '../src/projects.js';

const originalStubs = process.env.OD_MEDIA_ALLOW_STUBS;

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-test-'));
  const projectsRoot = path.join(root, '.od', 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { root, projectsRoot, projectId, dir };
}

beforeEach(() => {
  process.env.OD_MEDIA_ALLOW_STUBS = '1';
});

afterEach(() => {
  if (originalStubs == null) {
    delete process.env.OD_MEDIA_ALLOW_STUBS;
  } else {
    process.env.OD_MEDIA_ALLOW_STUBS = originalStubs;
  }
});

describe('media generation file containment', () => {
  it('rejects reference images that resolve outside the project through symlinks', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outsideFile = path.join(root, 'secret.txt');
    await writeFile(outsideFile, 'secret');
    await symlink(outsideFile, path.join(dir, 'ref.png'));

    await expect(
      generateMedia({
        projectRoot: root,
        projectsRoot,
        projectId,
        surface: 'image',
        model: 'flux-pro',
        prompt: 'make an image',
        output: 'out.png',
        image: 'ref.png',
      }),
    ).rejects.toThrow(/outside the project/i);
  });

  it('rejects media outputs that would overwrite a symlink target', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outsideFile = path.join(root, 'outside.png');
    await writeFile(outsideFile, 'keep');
    await symlink(outsideFile, path.join(dir, 'out.png'));

    await expect(
      generateMedia({
        projectRoot: root,
        projectsRoot,
        projectId,
        surface: 'image',
        model: 'flux-pro',
        prompt: 'make an image',
        output: 'out.png',
      }),
    ).rejects.toThrow(/symlink/i);
    await expect(readFile(outsideFile, 'utf8')).resolves.toBe('keep');
  });
});
