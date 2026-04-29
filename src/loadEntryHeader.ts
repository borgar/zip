import { PK12 } from './constants.ts';

export type ArchEntry = {
  name: string,
  comment: string,
  headerSize: number,
  filenameLength: number,
  extraLength: number,
  commentLength: number,
  versionMadeBy: number,
  version: number,
  flags: number,
  method: number,
  mtime: number,
  crc: number,
  compressedSize: number,
  originalSize: number,
  diskStart: number,
  iattr: number,
  attr: number,
  offset: number,
};

export function loadEntryHeader (data: DataView): ArchEntry {
  if (data.byteLength !== 46 || data.getUint32(0, true) !== PK12) {
    throw new Error('Invalid entry header');
  }
  return {
    versionMadeBy: data.getUint16(4, true),
    version: data.getUint16(6, true),
    flags: data.getUint16(8, true),
    method: data.getUint16(10, true),
    mtime: data.getUint32(12, true),
    crc: data.getUint32(16, true),
    compressedSize: data.getUint32(20, true),
    originalSize: data.getUint32(24, true),
    filenameLength: data.getUint16(28, true),
    extraLength: data.getUint16(30, true),
    commentLength: data.getUint16(32, true),
    diskStart: data.getUint16(34, true),
    iattr: data.getUint16(36, true),
    attr: data.getUint32(38, true),
    offset: data.getUint32(42, true),
    headerSize: 0,
    name: '',
    comment: '',
  };
}
