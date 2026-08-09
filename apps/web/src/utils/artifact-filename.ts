/**
 * Helpers for persisting chat artifact HTML into the project folder without
 * silently clobbering files the agent (or a prior turn) already wrote.
 */

export function slugArtifactBaseName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'artifact'
  );
}

/**
 * Pick `<base>.html`, then `<base>-2.html`, … until the name is absent from
 * `existing`. `existing` should reflect the on-disk project file set at
 * persist time (not a stale React state snapshot from turn start).
 */
export function pickUniqueArtifactFileName(
  baseName: string,
  existing: ReadonlySet<string>,
): string {
  const base = slugArtifactBaseName(baseName);
  let fileName = `${base}.html`;
  let n = 2;
  while (existing.has(fileName)) {
    fileName = `${base}-${n}.html`;
    n += 1;
  }
  return fileName;
}
