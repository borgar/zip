import { PK34 } from './constants.ts';

export type LocalHeaderParams = {
  method: number,
  mtime: number,
  crc: number,
  compressedSize: number,
  originalSize: number,
  filenameLength: number,
  flags?: number,
};

export function buildLocalHeader (params: LocalHeaderParams): ArrayBuffer {
  const buf = new ArrayBuffer(30);
  const v = new DataView(buf);
  v.setUint32(0, PK34, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, params.flags ?? 0x800, true);
  v.setUint16(8, params.method, true);
  v.setUint32(10, params.mtime, true);
  v.setUint32(14, params.crc, true);
  v.setUint32(18, params.compressedSize, true);
  v.setUint32(22, params.originalSize, true);
  v.setUint16(26, params.filenameLength, true);
  v.setUint16(28, 0, true);
  return buf;
}
