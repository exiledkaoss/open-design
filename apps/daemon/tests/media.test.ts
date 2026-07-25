import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { generateMedia } from '../src/media.js';
import { ensureProject } from '../src/projects.js';

const ORIGINAL_STUBS = process.env.OD_MEDIA_ALLOW_STUBS;

afterEach(() => {
  if (ORIGINAL_STUBS === undefined) {
    delete process.env.OD_MEDIA_ALLOW_STUBS;
  } else {
    process.env.OD_MEDIA_ALLOW_STUBS = ORIGINAL_STUBS;
  }
});

async function setupProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'od-media-test-'));
  const projectsRoot = path.join(root, 'projects');
  const projectId = 'p1';
  const dir = await ensureProject(projectsRoot, projectId);
  return { root, projectsRoot, projectId, dir };
}

describe('media generation containment', () => {
  it('does not write generated output through project symlinks', async () => {
    const { root, projectsRoot, projectId, dir } = await setupProject();
    const outside = path.join(root, 'outside.png');
    await writeFile(outside, 'keep');
    await symlink(outside, path.join(dir, 'image.png'));
    process.env.OD_MEDIA_ALLOW_STUBS = '1';

    await expect(
      generateMedia({
        projectRoot: root,
        projectsRoot,
        projectId,
        surface: 'image',
        model: 'flux-1.1-pro',
        prompt: 'placeholder',
        output: 'image.png',
      }),
    ).rejects.toThrow(/symlink/i);
    await expect(readFile(outside, 'utf8')).resolves.toBe('keep');
  });
});
