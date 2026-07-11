import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyProjectFileResponseHeaders,
  resolveDaemonResourceRoot,
  resolveProjectRoot,
} from '../src/server.js';

describe('resolveProjectRoot', () => {
  it('resolves the repository root from the source daemon directory', () => {
    const root = path.resolve(import.meta.dirname, '../../..');

    expect(resolveProjectRoot(path.join(root, 'apps', 'daemon'))).toBe(root);
  });

  it('resolves the repository root from the live TypeScript source directory', () => {
    const root = path.resolve(import.meta.dirname, '../../..');

    expect(resolveProjectRoot(path.join(root, 'apps', 'daemon', 'src'))).toBe(root);
  });

  it('resolves the repository root from the compiled daemon dist directory', () => {
    const root = path.resolve(import.meta.dirname, '../../..');

    expect(resolveProjectRoot(path.join(root, 'apps', 'daemon', 'dist'))).toBe(root);
  });

  it('resolves the repository root from the daemon src directory (tsx entry)', () => {
    const root = path.resolve(import.meta.dirname, '../../..');

    expect(resolveProjectRoot(path.join(root, 'apps', 'daemon', 'src'))).toBe(root);
  });
});

describe('resolveDaemonResourceRoot', () => {
  it('allows resource roots under an explicit safe base', () => {
    const safeBase = path.resolve(import.meta.dirname, '..', 'fixtures', 'resources');
    const configured = path.join(safeBase, 'packaged');

    expect(resolveDaemonResourceRoot({ configured, safeBases: [safeBase] })).toBe(configured);
  });

  it('allows a resource root equal to an explicit safe base', () => {
    const safeBase = path.resolve(import.meta.dirname, '..', 'fixtures', 'resources');

    expect(resolveDaemonResourceRoot({ configured: safeBase, safeBases: [safeBase] })).toBe(safeBase);
  });

  it('rejects resource roots outside the safe bases', () => {
    const safeBase = path.resolve(import.meta.dirname, '..', 'fixtures', 'resources');
    const configured = path.resolve(import.meta.dirname, '..', 'fixtures-other', 'resources');

    expect(() => resolveDaemonResourceRoot({ configured, safeBases: [safeBase] })).toThrow(
      /OD_RESOURCE_ROOT must be under/,
    );
  });
});

describe('applyProjectFileResponseHeaders', () => {
  it('disables script execution for raw SVG and HTML project files', () => {
    for (const mime of ['image/svg+xml', 'text/html; charset=utf-8']) {
      const headers = new Map<string, string>();
      const res = {
        setHeader(name: string, value: string) {
          headers.set(name.toLowerCase(), value);
        },
      };

      applyProjectFileResponseHeaders(res as any, { mime });

      expect(headers.get('content-security-policy')).toContain("script-src 'none'");
      expect(headers.get('x-content-type-options')).toBe('nosniff');
    }
  });
});
