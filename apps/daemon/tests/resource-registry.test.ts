import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readDesignSystem } from '../src/design-systems.js';
import { readPromptTemplate } from '../src/prompt-templates.js';

describe('curated resource registry containment', () => {
  it('rejects traversal-shaped prompt template ids', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'od-prompt-registry-test-'));
    await mkdir(path.join(root, 'image'), { recursive: true });
    await mkdir(path.join(root, 'outside'), { recursive: true });
    await writeFile(
      path.join(root, 'outside', 'evil.json'),
      JSON.stringify({
        id: 'evil',
        surface: 'image',
        title: 'Evil',
        prompt: 'This prompt is intentionally long enough to pass validation.',
        source: { repo: 'local', license: 'test' },
      }),
    );

    await expect(readPromptTemplate(root, 'image', '../outside/evil')).resolves.toBeNull();
  });

  it('rejects traversal-shaped design system ids', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'od-design-registry-test-'));
    await mkdir(path.join(root, 'systems'), { recursive: true });
    await mkdir(path.join(root, 'outside'), { recursive: true });
    await writeFile(path.join(root, 'outside', 'DESIGN.md'), '# Outside\n\nsecret');

    await expect(readDesignSystem(path.join(root, 'systems'), '../outside')).resolves.toBeNull();
  });
});
