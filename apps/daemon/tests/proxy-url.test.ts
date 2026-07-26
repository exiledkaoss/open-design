import { describe, expect, it } from 'vitest';
import {
  buildProxyChatCompletionsUrl,
  isBlockedIpAddress,
  isBlockedProxyHostname,
  normalizeHostname,
  parseProxyBaseUrl,
  ProxyUrlError,
} from '../src/proxy-url.js';

describe('normalizeHostname', () => {
  it('strips Node URL brackets from IPv6 literals', () => {
    expect(normalizeHostname('[::1]')).toBe('::1');
    expect(normalizeHostname('[::ffff:7f00:1]')).toBe('::ffff:7f00:1');
  });
});

describe('isBlockedIpAddress / isBlockedProxyHostname', () => {
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
      expect(isBlockedProxyHostname(addr), addr).toBe(true);
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
      expect(isBlockedProxyHostname(addr), addr).toBe(true);
    }
  });

  it('allows public IPv4/IPv6 literals and normal hostnames', () => {
    for (const host of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888', 'api.openai.com', 'example.com']) {
      expect(isBlockedProxyHostname(host), host).toBe(false);
    }
  });

  it('blocks localhost names', () => {
    expect(isBlockedProxyHostname('localhost')).toBe(true);
    expect(isBlockedProxyHostname('Foo.Localhost')).toBe(true);
  });
});

describe('parseProxyBaseUrl', () => {
  it('rejects the Node-bracketed IPv6 loopback that used to bypass SSRF checks', () => {
    // Regression: new URL("http://[::1]").hostname === "[::1]", and the old
    // allowlist compared against bare "::1", so this URL reached fetch().
    expect(() => parseProxyBaseUrl('http://[::1]:1234/v1')).toThrow(ProxyUrlError);
    try {
      parseProxyBaseUrl('http://[::1]:1234/v1');
    } catch (err) {
      expect(err).toMatchObject({ code: 'FORBIDDEN', message: 'Internal IPs blocked' });
    }
  });

  it('rejects non-http(s) schemes and accepts a public https base', () => {
    expect(() => parseProxyBaseUrl('file:///etc/passwd')).toThrow(/http\/https/);
    const parsed = parseProxyBaseUrl('https://api.openai.com/v1/');
    expect(parsed.hostname).toBe('api.openai.com');
  });
});

describe('buildProxyChatCompletionsUrl', () => {
  it('appends /chat/completions when base already ends with /vN', () => {
    expect(buildProxyChatCompletionsUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
  });

  it('inserts /v1/chat/completions otherwise', () => {
    expect(buildProxyChatCompletionsUrl('https://example.com')).toBe(
      'https://example.com/v1/chat/completions',
    );
  });
});
