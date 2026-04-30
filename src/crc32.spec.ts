import { describe, expect, it } from 'vitest';
import { crc32 } from './crc32.ts';

const enc = new TextEncoder();

describe('crc32', () => {
  it('returns 0 for empty input', () => {
    expect(crc32(new Uint8Array([]))).toBe(0);
  });

  it('matches the standard CRC32 check value for "123456789"', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xCBF43926);
  });

  it('returns an unsigned 32-bit integer', () => {
    const result = crc32(enc.encode('test'));
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('is deterministic', () => {
    const input = enc.encode('lorem ipsum dolor set amet');
    expect(crc32(input)).toBe(crc32(input));
  });

  it('produces different values for different inputs', () => {
    expect(crc32(enc.encode('foo'))).not.toBe(crc32(enc.encode('bar')));
  });

  it('is sensitive to byte order', () => {
    expect(crc32(new Uint8Array([ 1, 2, 3 ]))).not.toBe(crc32(new Uint8Array([ 3, 2, 1 ])));
  });
});
