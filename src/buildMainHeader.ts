import { PK56 } from './constants.ts';

export function buildMainHeader (entryCount: number, cdSize: number, cdOffset: number): ArrayBuffer {
  const buf = new ArrayBuffer(22);
  const v = new DataView(buf);
  v.setUint32(0, PK56, true);
  v.setUint16(4, 0, true);
  v.setUint16(6, 0, true);
  v.setUint16(8, entryCount, true);
  v.setUint16(10, entryCount, true);
  v.setUint32(12, cdSize, true);
  v.setUint32(16, cdOffset, true);
  v.setUint16(20, 0, true);
  return buf;
}
