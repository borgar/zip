import { PK34 } from './constants.ts';

export type LocEntry = {
  version: number,
  flags: number,
  method: number,
  mtime: number,
  crc: number,
  compressedSize: number,
  originalSize: number,
  filenameLength: number,
  extraLength: number,
};

export function loadLocalHeader (data: DataView): LocEntry {
  if (data.byteLength !== 30 || data.getUint32(0, true) !== PK34) {
    throw new Error('Invalid local header');
  }
  return {
    version: data.getUint16(4, true),
    flags: data.getUint16(6, true),
    method: data.getUint16(8, true),
    mtime: data.getUint32(10, true),
    crc: data.getUint32(14, true),
    compressedSize: data.getUint32(18, true),
    originalSize: data.getUint32(22, true),
    filenameLength: data.getUint16(26, true),
    extraLength: data.getUint16(28, true),
  };
}
