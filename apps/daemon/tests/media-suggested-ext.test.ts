import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  applySuggestedOutputExt,
  writeMediaOutputExclusive,
} from '../src/media.js';

describe('applySuggestedOutputExt', () => {
  it('rewrites a mismatched extension to the provider suggestion', () => {
    expect(applySuggestedOutputExt('hero.jpg', '.png')).toBe('hero.png');
    expect(applySuggestedOutputExt('a.webp', '.png')).toBe('a.png');
    expect(applySuggestedOutputExt('clip.mov', '.mp4')).toBe('clip.mp4');
  });

  it('keeps the name when the extension already matches', () => {
    expect(applySuggestedOutputExt('hero.png', '.png')).toBe('hero.png');
    expect(applySuggestedOutputExt('Hero.PNG', '.png')).toBe('Hero.PNG');
    expect(applySuggestedOutputExt('out.mp4', '.mp4')).toBe('out.mp4');
  });

  it('ignores empty or malformed suggestions', () => {
    expect(applySuggestedOutputExt('hero.jpg', '')).toBe('hero.jpg');
    expect(applySuggestedOutputExt('hero.jpg', null)).toBe('hero.jpg');
    expect(applySuggestedOutputExt('hero.jpg', 'png')).toBe('hero.jpg');
  });
});

describe('writeMediaOutputExclusive', () => {
  async function setupDir() {
    return mkdtemp(path.join(os.tmpdir(), 'od-media-out-'));
  }

  it('does not clobber a different existing file when extension was rewritten', async () => {
    const dir = await setupDir();
    await writeFile(path.join(dir, 'hero.png'), 'PRIOR_PNG');

    // Caller asked for hero.jpg; provider suggested .png → hero.png.
    const preferred = applySuggestedOutputExt('hero.jpg', '.png');
    expect(preferred).toBe('hero.png');

    const written = await writeMediaOutputExclusive(
      dir,
      preferred,
      Buffer.from('NEW_BYTES'),
      { allowOverwrite: preferred === 'hero.jpg' },
    );

    expect(written.name).not.toBe('hero.png');
    expect(written.name).toMatch(/^hero-[a-z0-9]+\.png$/);
    expect(await readFile(path.join(dir, 'hero.png'), 'utf8')).toBe('PRIOR_PNG');
    expect(await readFile(written.target, 'utf8')).toBe('NEW_BYTES');
  });

  it('keeps concurrent rewritten names from collapsing onto one path', async () => {
    const dir = await setupDir();
    const preferredA = applySuggestedOutputExt('a.jpg', '.png');
    const preferredB = applySuggestedOutputExt('a.webp', '.png');
    expect(preferredA).toBe('a.png');
    expect(preferredB).toBe('a.png');

    const [first, second] = await Promise.all([
      writeMediaOutputExclusive(dir, preferredA, Buffer.from('A'), {
        allowOverwrite: false,
      }),
      writeMediaOutputExclusive(dir, preferredB, Buffer.from('B'), {
        allowOverwrite: false,
      }),
    ]);

    expect(first.name).not.toBe(second.name);
    const bodies = new Set([
      await readFile(first.target, 'utf8'),
      await readFile(second.target, 'utf8'),
    ]);
    expect(bodies).toEqual(new Set(['A', 'B']));
  });

  it('still overwrites when writing the exact caller-chosen path', async () => {
    const dir = await setupDir();
    await writeFile(path.join(dir, 'hero.png'), 'OLD');
    const preferred = applySuggestedOutputExt('hero.png', '.png');
    expect(preferred).toBe('hero.png');

    const written = await writeMediaOutputExclusive(
      dir,
      preferred,
      Buffer.from('NEW'),
      { allowOverwrite: preferred === 'hero.png' },
    );

    expect(written.name).toBe('hero.png');
    expect(await readFile(written.target, 'utf8')).toBe('NEW');
  });

  it('creates parent-relative names under the project dir', async () => {
    const dir = await setupDir();
    await mkdir(path.join(dir, 'assets'), { recursive: true });
    // sanitizeName flattens path seps; generateMedia joins dir + safeOut.
    // This test only covers the exclusive writer itself.
    const written = await writeMediaOutputExclusive(
      dir,
      'shot.png',
      Buffer.from('X'),
      { allowOverwrite: true },
    );
    expect(written.target).toBe(path.join(dir, 'shot.png'));
  });
});
