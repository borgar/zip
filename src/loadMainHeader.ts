import { PK56, PK66 } from './constants.ts';
import { readBigUInt64LE } from './readBigUInt64LE.ts';

export type MainHead = {
  volumeEntries: number,
  totalEntries: number,
  size: number,
  offset: number,
  commentLength: number,
};

export function loadMainHeader (data: DataView): MainHead {
  // data should be 22 bytes and start with "PK 05 06"
  // or be 56+ bytes and start with "PK 06 06" for Zip64
  if (data.byteLength === 22 && data.getUint32(0, true) === PK56) {
    return {
      volumeEntries: data.getUint16(8, true),
      totalEntries: data.getUint16(10, true),
      size: data.getUint32(12, true),
      offset: data.getUint32(16, true),
      commentLength: data.getUint16(20, true),
    };
  }
  else if (data.byteLength >= 56 && data.getUint32(0, true) === PK66) {
    return {
      volumeEntries: readBigUInt64LE(data, 24),
      totalEntries: readBigUInt64LE(data, 32),
      size: readBigUInt64LE(data, 4),
      offset: readBigUInt64LE(data, 48),
      commentLength: 0,
    };
  }
  throw new Error('Invalid main header');
}
