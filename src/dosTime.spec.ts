import { describe, expect, it } from 'vitest';
import { dateToDos, dosToDate } from './dosTime.ts';

describe('dateToDos', () => {
  it('returns the correct value for the DOS epoch', () => {
    expect(dateToDos(new Date(Date.UTC(1980, 0, 1, 0, 0, 0)))).toBe(0x00210000);
  });

  it('clamps dates before 1980 to the DOS epoch', () => {
    expect(dateToDos(new Date(Date.UTC(1975, 9, 16, 0, 0, 0)))).toBe(0x00210000);
  });

  it('clamps dates after 2099 to the maximum DOS date', () => {
    expect(dateToDos(new Date(Date.UTC(2100, 0, 1, 0, 0, 0)))).toBe(0xEF9FBF7D);
  });

  it('encodes a known date to the expected packed value', () => {
    expect(dateToDos(new Date(Date.UTC(2024, 5, 15, 10, 30, 22)))).toBe(0x58CF53CB);
  });

  it('truncates seconds to 2-second resolution', () => {
    const a = dateToDos(new Date(Date.UTC(1980, 0, 1, 0, 0, 2)));
    const b = dateToDos(new Date(Date.UTC(1980, 0, 1, 0, 0, 3)));
    expect(a).toBe(b);
  });

  it('produces different values for different dates', () => {
    const a = dateToDos(new Date(Date.UTC(2020, 0, 1, 0, 0, 0)));
    const b = dateToDos(new Date(Date.UTC(2021, 0, 1, 0, 0, 0)));
    expect(a).not.toBe(b);
  });

  it('returns a non-negative integer', () => {
    const result = dateToDos(new Date(Date.UTC(2000, 5, 15, 12, 0, 0)));
    expect(result).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('dosToDate', () => {
  it('decodes the DOS epoch to 1980-01-01T00:00:00.000Z', () => {
    expect(dosToDate(0x00210000).getTime()).toBe(Date.UTC(1980, 0, 1, 0, 0, 0));
  });

  it('decodes a known packed value to the expected UTC date', () => {
    const d = dosToDate(0x58CF53CB);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(10);
    expect(d.getUTCMinutes()).toBe(30);
    expect(d.getUTCSeconds()).toBe(22);
  });

  it('round-trips with dateToDos (2-second resolution)', () => {
    const original = new Date(Date.UTC(2024, 5, 15, 10, 30, 22));
    expect(dosToDate(dateToDos(original)).getTime()).toBe(original.getTime());
  });

  it('returns a Date instance', () => {
    expect(dosToDate(0x00210000)).toBeInstanceOf(Date);
  });
});
