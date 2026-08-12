/**
 * Helpers that keep untrusted user/template strings from breaking out of
 * the composed system prompt (section headers, markdown fences, etc.).
 * Used by both the contracts composer (web/Anthropic path) and the daemon
 * composer (local agent path).
 */

/** Strip controls/newlines so values stay on one prompt line/section. */
export function promptSafeText(raw: unknown): string {
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ');
}

/**
 * Neutralize markdown fences inside embedded template/file bodies so a
 * crafted ` ``` ` sequence cannot close the surrounding fence and inject
 * instructions into the system prompt.
 */
export function promptSafeFenced(raw: unknown): string {
  return String(raw ?? '').replace(/```/g, '``\u200b`');
}
