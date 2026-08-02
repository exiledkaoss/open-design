import { describe, expect, it } from 'vitest';
import {
  assertSafeOutboundUrl,
  fetchOutboundUrlBytes,
  isBlockedHostname,
  isBlockedIpAddress,
  normalizeHostname,
  parseOutboundUrl,
  UnsafeUrlError,
} from '../src/safe-url.js';

describe('normalizeHostname', () => {
  it('strips Node URL brackets from IPv6 literals', () => {
    expect(normalizeHostname('[::1]')).toBe('::1');
    expect(normalizeHostname('[::ffff:7f00:1]')).toBe('::ffff:7f00:1');
  });
});

describe('isBlockedIpAddress / isBlockedHostname', () => {
  it('blocks IPv4 loopback, RFC1918, link-local, and 0.0.0.0', () => {
    for (const addr of [
      '127.0.0.1',
      '127.1.2.3',
      '0.0.0.0',
      '10.0.0.1',
      '192.168.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.169.254',
    ]) {
      expect(isBlockedIpAddress(addr), addr).toBe(true);
      expect(isBlockedHostname(addr), addr).toBe(true);
    }
  });

  it('blocks IPv6 loopback / ULA / link-local, including bracketed forms', () => {
    for (const addr of [
      '::1',
      '[::1]',
      '::',
      'fc00::1',
      '[fd12:3456::1]',
      'fe80::1',
      '[fe80::abcd]',
      '::ffff:127.0.0.1',
      '[::ffff:127.0.0.1]',
      '::ffff:7f00:1',
      '[::ffff:7f00:1]',
      '::ffff:a00:1', // 10.0.0.1
    ]) {
      expect(isBlockedHostname(addr), addr).toBe(true);
    }
  });

  it('allows public IPv4/IPv6 literals and normal hostnames', () => {
    for (const host of [
      '8.8.8.8',
      '1.1.1.1',
      '2001:4860:4860::8888',
      'api.openai.com',
      'example.com',
    ]) {
      expect(isBlockedHostname(host), host).toBe(false);
    }
  });

  it('blocks localhost names', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('Foo.Localhost')).toBe(true);
  });
});

describe('parseOutboundUrl / assertSafeOutboundUrl', () => {
  it('rejects bracketed IPv6 loopback that Node URL.hostname returns', () => {
    expect(() => parseOutboundUrl('http://[::1]:1234/secret')).toThrow(UnsafeUrlError);
    try {
      parseOutboundUrl('http://[::1]:1234/secret');
    } catch (err) {
      expect(err).toMatchObject({ code: 'FORBIDDEN', message: 'Internal IPs blocked' });
    }
  });

  it('rejects cloud metadata and private literals used as media response URLs', () => {
    expect(() => parseOutboundUrl('http://169.254.169.254/latest/meta-data/')).toThrow(
      /Internal IPs blocked/,
    );
    expect(() => parseOutboundUrl('http://127.0.0.1:7456/api/media/config')).toThrow(
      /Internal IPs blocked/,
    );
    expect(() => parseOutboundUrl('http://192.168.1.50/admin')).toThrow(/Internal IPs blocked/);
  });

  it('rejects non-http(s) schemes and accepts a public https URL', async () => {
    expect(() => parseOutboundUrl('file:///etc/passwd')).toThrow(/http\/https/);
    const parsed = await assertSafeOutboundUrl('https://cdn.openai.com/image.png');
    expect(parsed.hostname).toBe('cdn.openai.com');
  });
});

describe('fetchOutboundUrlBytes', () => {
  it('refuses redirects instead of following an unvalidated Location', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/secret' },
      });
    try {
      await expect(fetchOutboundUrlBytes('https://example.com/img.png')).rejects.toMatchObject({
        name: 'UnsafeUrlError',
        code: 'FORBIDDEN',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns bytes for a successful public response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toBe('https://example.com/img.png');
      expect(init?.redirect).toBe('manual');
      return new Response(Uint8Array.from([1, 2, 3]), { status: 200 });
    };
    try {
      const bytes = await fetchOutboundUrlBytes('https://example.com/img.png');
      expect(Buffer.from(bytes)).toEqual(Buffer.from([1, 2, 3]));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not call fetch when the URL is a blocked literal', async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response('nope');
    };
    try {
      await expect(fetchOutboundUrlBytes('http://127.0.0.1/secret')).rejects.toBeInstanceOf(
        UnsafeUrlError,
      );
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
