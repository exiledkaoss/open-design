import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { generateMedia } from '../src/media.js';
import { ensureProject } from '../src/projects.js';

const ORIGINAL_STUBS = process.env.OD_MEDIA_ALLOW_STUBS;

async function setupProject() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'od-media-test-'));
  const projectsRoot = path.join(projectRoot, '.od', 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { projectRoot, projectsRoot, projectId, dir };
}

afterEach(() => {
  if (ORIGINAL_STUBS === undefined) {
    delete process.env.OD_MEDIA_ALLOW_STUBS;
  } else {
    process.env.OD_MEDIA_ALLOW_STUBS = ORIGINAL_STUBS;
  }
});

describe('media project containment', () => {
  it('rejects reference images that resolve outside the project through a symlink', async () => {
    const { projectRoot, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(projectRoot, 'outside.png');
    await writeFile(outside, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await symlink(outside, path.join(dir, 'ref.png'));

    await expect(
      generateMedia({
        projectRoot,
        projectsRoot,
        projectId,
        surface: 'image',
        model: 'flux-1.1-pro',
        prompt: 'test',
        image: 'ref.png',
        output: 'result.png',
      }),
    ).rejects.toThrow(/outside the project directory/i);
  });

  it('does not overwrite an outside file through a media output symlink', async () => {
    process.env.OD_MEDIA_ALLOW_STUBS = '1';
    const { projectRoot, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(projectRoot, 'outside.png');
    await writeFile(outside, 'keep');
    await symlink(outside, path.join(dir, 'result.png'));

    await expect(
      generateMedia({
        projectRoot,
        projectsRoot,
        projectId,
        surface: 'image',
        model: 'flux-pro',
        prompt: 'test',
        output: 'result.png',
      }),
    ).rejects.toMatchObject({ code: 'ELOOP' });
    await expect(readFile(outside, 'utf8')).resolves.toBe('keep');
  });
});
