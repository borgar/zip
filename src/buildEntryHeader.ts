import { PK12 } from './constants.ts';
import type { ArchEntry } from './loadEntryHeader.ts';

export function buildEntryHeader (entry: ArchEntry, localOffset: number, nameBytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(46);
  const v = new DataView(buf);
  v.setUint32(0, PK12, true);
  v.setUint16(4, entry.versionMadeBy, true);
  v.setUint16(6, entry.version, true);
  v.setUint16(8, entry.flags, true);
  v.setUint16(10, entry.method, true);
  v.setUint32(12, entry.mtime, true);
  v.setUint32(16, entry.crc, true);
  v.setUint32(20, entry.compressedSize, true);
  v.setUint32(24, entry.originalSize, true);
  v.setUint16(28, nameBytes.byteLength, true);
  v.setUint16(30, 0, true);
  v.setUint16(32, 0, true);
  v.setUint16(34, 0, true);
  v.setUint16(36, entry.iattr, true);
  v.setUint32(38, entry.attr, true);
  v.setUint32(42, localOffset, true);
  return buf;
}
