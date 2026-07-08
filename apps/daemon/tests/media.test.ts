import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  generateMedia,
  resolveProjectCompositionDirectory,
} from '../src/media.js';
import { ensureProject } from '../src/projects.js';

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-test-'));
  const projectsRoot = path.join(root, 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { root, projectsRoot, projectId, dir };
}

describe('media project path containment', () => {
  it.skipIf(process.platform === 'win32')(
    'rejects image symlinks that resolve outside the project',
    async () => {
      const { root, projectsRoot, projectId, dir } = await setupProject();
      const external = path.join(root, 'secret.png');
      await writeFile(external, 'not really an image, but still sensitive');
      await symlink(external, path.join(dir, 'ref.png'));

      await expect(
        generateMedia({
          projectRoot: root,
          projectsRoot,
          projectId,
          surface: 'video',
          model: 'doubao-seedance-2-0-260128',
          image: 'ref.png',
          prompt: 'animate the reference',
        }),
      ).rejects.toThrow(/resolves outside the project directory/);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'rejects HyperFrames composition directories symlinked outside the project',
    async () => {
      const { root, dir } = await setupProject();
      const external = path.join(root, 'external-composition');
      await mkdir(external);
      await writeFile(path.join(external, 'index.html'), '<!doctype html><h1>outside</h1>');
      await symlink(external, path.join(dir, 'composition'));

      await expect(
        resolveProjectCompositionDirectory('composition', dir),
      ).rejects.toThrow(/resolves outside the project directory/);
    },
  );
});
