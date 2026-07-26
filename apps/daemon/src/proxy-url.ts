// @ts-nocheck
// Safety checks for the BYOK OpenAI-compatible proxy (/api/proxy/stream).
//
// The browser posts an arbitrary baseUrl; without these guards the daemon
// becomes an SSRF trampoline to loopback / link-local / private networks
// (including cloud metadata). Node's URL parser returns IPv6 literals with
// brackets (e.g. "[::1]"), so string-equality checks against "∷1" miss.

import dns from 'node:dns/promises';
import net from 'node:net';

export class ProxyUrlError extends Error {
  /**
   * @param {string} message
   * @param {number} [status]
   * @param {string} [code]
   */
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'ProxyUrlError';
    this.status = status;
    this.code = code;
  }
}

/** Strip Node URL brackets from IPv6 hostnames and lowercase. */
export function normalizeHostname(hostname) {
  const raw = String(hostname || '').trim().toLowerCase();
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1);
  return raw;
}

/**
 * Parse ::ffff:7f00:1 / ::ffff:127.0.0.1 into a dotted IPv4 string.
 * @param {string} addr
 * @returns {string | null}
 */
function ipv4MappedAddress(addr) {
  if (addr.includes('.')) {
    const v4 = addr.slice(addr.lastIndexOf(':') + 1);
    return net.isIPv4(v4) ? v4 : null;
  }
  const match = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;
  const hi = Number.parseInt(match[1], 16);
  const lo = Number.parseInt(match[2], 16);
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

/** True when `address` is loopback, link-local, ULA, or RFC1918. */
export function isBlockedIpAddress(address) {
  const addr = normalizeHostname(address);
  if (!addr) return true;

  if (net.isIPv4(addr)) {
    const [a, b] = addr.split('.').map((part) => Number.parseInt(part, 10));
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  if (net.isIPv6(addr)) {
    if (addr === '::' || addr === '::1') return true;
    const mapped = ipv4MappedAddress(addr);
    if (mapped) return isBlockedIpAddress(mapped);
    // fe80::/10 link-local
    if (/^fe[89ab][0-9a-f]{0,2}:/i.test(addr)) return true;
    // fc00::/7 unique local
    if (/^f[cd][0-9a-f]{0,2}:/i.test(addr)) return true;
    return false;
  }

  return false;
}

/** Hostname-level blocklist before DNS resolution. */
export function isBlockedProxyHostname(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (net.isIP(host)) return isBlockedIpAddress(host);
  return false;
}

/**
 * Parse + statically validate a proxy baseUrl (protocol + literal host).
 * @param {unknown} baseUrl
 */
export function parseProxyBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(String(baseUrl || '').replace(/\/+$/, ''));
  } catch {
    throw new ProxyUrlError('Invalid baseUrl');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ProxyUrlError('Only http/https allowed');
  }
  if (isBlockedProxyHostname(parsed.hostname)) {
    throw new ProxyUrlError('Internal IPs blocked', 400, 'FORBIDDEN');
  }
  return parsed;
}

/**
 * Fully validate baseUrl for proxy use: parse, block private literals, and
 * refuse hostnames that currently resolve to private/link-local addresses.
 * @param {unknown} baseUrl
 */
export async function assertSafeProxyBaseUrl(baseUrl) {
  const parsed = parseProxyBaseUrl(baseUrl);
  const host = normalizeHostname(parsed.hostname);
  if (net.isIP(host)) return parsed;

  let results;
  try {
    results = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new ProxyUrlError('Unable to resolve baseUrl host');
  }
  for (const result of results) {
    if (isBlockedIpAddress(result.address)) {
      throw new ProxyUrlError('Internal IPs blocked', 400, 'FORBIDDEN');
    }
  }
  return parsed;
}

/** Build the upstream chat-completions URL from a validated baseUrl. */
export function buildProxyChatCompletionsUrl(baseUrl) {
  const clean = String(baseUrl).replace(/\/+$/, '');
  if (/\/v\d+$/.test(clean)) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}
