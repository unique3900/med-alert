import { describe, expect, it } from 'vitest';
import { normalizePrivateKey } from '@/lib/env';

const BODY = 'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC5WGFGaKX50g4P';
const PEM = `-----BEGIN PRIVATE KEY-----\n${BODY}\n-----END PRIVATE KEY-----\n`;

describe('normalizePrivateKey', () => {
  it('accepts a key with literal backslash-n, as pasted from a JSON field', () => {
    const raw = String.raw`-----BEGIN PRIVATE KEY-----\n${BODY}\n-----END PRIVATE KEY-----\n`;
    expect(normalizePrivateKey(raw)).toBe(PEM);
  });

  it('accepts a key that already has real newlines', () => {
    expect(normalizePrivateKey(PEM)).toBe(PEM);
  });

  it('strips surrounding double quotes kept by a dashboard field', () => {
    const raw = `"${String.raw`-----BEGIN PRIVATE KEY-----\n${BODY}\n-----END PRIVATE KEY-----\n`}"`;
    expect(normalizePrivateKey(raw)).toBe(PEM);
  });

  it('strips surrounding single quotes', () => {
    expect(normalizePrivateKey(`'${PEM}'`)).toBe(PEM);
  });

  it('survives CRLF', () => {
    expect(normalizePrivateKey(PEM.replace(/\n/g, '\r\n'))).toBe(PEM);
  });

  it('decodes a key that was base64-encoded whole', () => {
    expect(normalizePrivateKey(Buffer.from(PEM, 'utf8').toString('base64'))).toBe(PEM);
  });

  it('tolerates leading and trailing whitespace', () => {
    expect(normalizePrivateKey(`\n  ${PEM}  \n`)).toBe(PEM);
  });

  it('rejects a masked value rather than handing garbage to firebase-admin', () => {
    expect(() => normalizePrivateKey('••••••••••••')).toThrow(/not a PEM key/);
  });

  it('names the problem when the value is truncated', () => {
    expect(() => normalizePrivateKey('-----BEGIN PRIVATE KEY-----')).toThrow(/not a PEM key/);
  });
});
