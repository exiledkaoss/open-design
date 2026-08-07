import { describe, expect, it, vi, afterEach } from 'vitest';

import { autoOutputName } from '../src/media.js';

describe('autoOutputName', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes entropy so same-millisecond concurrent generates do not collide', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const names = new Set(
      Array.from({ length: 40 }, () => autoOutputName('image', 'gpt-image-2', undefined)),
    );
    expect(names.size).toBe(40);
    for (const name of names) {
      expect(name).toMatch(/^image-gpt-image-2-[a-z0-9]+-[a-z0-9]+\.png$/);
    }
  });

  it('keeps audio kind in the filename tag', () => {
    const name = autoOutputName('audio', 'minimax-tts', 'speech');
    expect(name.startsWith('audio-speech-minimax-tts-')).toBe(true);
    expect(name.endsWith('.mp3')).toBe(true);
  });
});
