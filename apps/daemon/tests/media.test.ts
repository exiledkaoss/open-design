import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { generateMedia } from '../src/media.js';
import { ensureProject } from '../src/projects.js';

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-test-'));
  const projectsRoot = path.join(root, 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { root, projectsRoot, projectId, dir };
}

describe('media project path containment', () => {
  const originalStubFlag = process.env.OD_MEDIA_ALLOW_STUBS;

  afterEach(() => {
    if (originalStubFlag === undefined) {
      delete process.env.OD_MEDIA_ALLOW_STUBS;
    } else {
      process.env.OD_MEDIA_ALLOW_STUBS = originalStubFlag;
    }
  });

  it('rejects reference images that are project-local symlinks', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const secretPath = path.join(root, 'secret.png');
    await writeFile(secretPath, 'not really a png');
    await symlink(secretPath, path.join(dir, 'ref.png'));

    await expect(
      generateMedia({
        projectRoot: root,
        projectsRoot,
        projectId,
        surface: 'image',
        model: 'flux-1.1-pro',
        image: 'ref.png',
      }),
    ).rejects.toThrow(/symlinks are not allowed/);
  });

  it('rejects output paths that would overwrite symlink targets', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const secretPath = path.join(root, 'media-config.json');
    await writeFile(secretPath, '{"apiKey":"real"}');
    await symlink(secretPath, path.join(dir, 'out.png'));
    process.env.OD_MEDIA_ALLOW_STUBS = '1';

    await expect(
      generateMedia({
        projectRoot: root,
        projectsRoot,
        projectId,
        surface: 'image',
        model: 'flux-1.1-pro',
        output: 'out.png',
      }),
    ).rejects.toThrow(/symlinks are not allowed/);
    await expect(readFile(secretPath, 'utf8')).resolves.toBe('{"apiKey":"real"}');
  });
});
