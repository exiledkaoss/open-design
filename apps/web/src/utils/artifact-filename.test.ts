import { describe, expect, it } from 'vitest';
import { pickUniqueArtifactFileName, slugArtifactBaseName } from './artifact-filename';

describe('slugArtifactBaseName', () => {
  it('kebabs and trims noisy titles', () => {
    expect(slugArtifactBaseName('Dashboard View!!')).toBe('dashboard-view');
  });

  it('falls back when the slug would be empty', () => {
    expect(slugArtifactBaseName('???')).toBe('artifact');
    expect(slugArtifactBaseName('')).toBe('artifact');
  });
});

describe('pickUniqueArtifactFileName', () => {
  it('uses the base name when free', () => {
    expect(pickUniqueArtifactFileName('dashboard', new Set())).toBe('dashboard.html');
  });

  it('avoids colliding with an agent-written file of the same slug', () => {
    // Concrete trigger: agent Write tool created dashboard.html mid-turn;
    // artifact identifier also slugs to "dashboard". Persist must not
    // overwrite the on-disk design.
    const existing = new Set(['dashboard.html']);
    expect(pickUniqueArtifactFileName('dashboard', existing)).toBe('dashboard-2.html');
  });

  it('walks past a dense collision set', () => {
    const existing = new Set(['report.html', 'report-2.html', 'report-3.html']);
    expect(pickUniqueArtifactFileName('report', existing)).toBe('report-4.html');
  });
});
