import { PK56, PK66, PK67 } from './constants.ts';
import { loadEntryHeader, type ArchEntry } from './loadEntryHeader.ts';
import { loadMainHeader } from './loadMainHeader.ts';
import { parseExtra } from './parseExtra.ts';
import { readBigUInt64LE } from './readBigUInt64LE.ts';
import { crc32 } from './crc32.ts';
import { decodeCp437 } from './decodeCp437.ts';

export function zipIndex (data: ArrayBuffer): Map<string, ArchEntry> {
  const entryTable = new Map<string, ArchEntry>();
  const dataView = new DataView(data);

  let endStart = dataView.byteLength;
  let endOffset = -1;

  let i = dataView.byteLength - 22;
  const max = Math.max(0, i - 0xffff);
  let n = max;
  for (i; i >= n; i--) {
    // is there a faster way to jump to next P?
    if (dataView.getInt8(i) !== 0x50) { // is not a 'P'
      continue;
    }
    if (dataView.getUint32(i, true) === PK56) {
      endOffset = i;
      endStart = i + 22;
      n = Math.max(max, i - 20);
      continue;
    }
    if (dataView.getUint32(i, true) === PK67) {
      n = max;
      continue;
    }
    if (dataView.getUint32(i, true) === PK66) {
      endOffset = i;
      endStart = i + readBigUInt64LE(dataView, i + 4) + 12;
      break;
    }
  }

  if (endOffset === -1) {
    throw new Error('Invalid archive format');
  }

  const mainHeader = loadMainHeader(new DataView(data, endOffset, endStart - endOffset));

  // Offsets in the EOCD are relative to the original archive start. If bytes were prepended,
  // every offset is off by the same amount. Derive the shift from the known EOCD position.
  const shift = endOffset - mainHeader.size - mainHeader.offset;

  if (shift < 0) {
    throw new Error('Invalid archive: missing bytes');
  }

  const entriesLength = mainHeader.volumeEntries;
  let index = mainHeader.offset + shift; // actual offset of first CEN header

  const td = new TextDecoder();
  for (i = 0; i < entriesLength; i++) {
    const entry = loadEntryHeader(new DataView(data, index, 46));
    const isUTF8 = entry.flags & 0x800;

    const fnStart = index + 46;
    const fnData = data.slice(fnStart, fnStart + entry.filenameLength);
    let entryName = isUTF8 ? td.decode(fnData) : decodeCp437(fnData);

    const cStart = index + 46 + entry.filenameLength + entry.extraLength;
    const cData = data.slice(cStart, cStart + entry.commentLength);
    entry.comment = isUTF8 ? td.decode(cData) : decodeCp437(cData);

    const eStart = index + 46 + entry.filenameLength;
    const xData = data.slice(eStart, eStart + entry.extraLength);
    entry.extra = parseExtra(xData);

    entry.extra.forEach(extra => {
      // if bit 11 of flags is set, then the filename is already is already UTF-8
      if (!isUTF8 && extra.headerId === 0x7075 && extra?.data.at(0) === 1) { // "up": Unicode path
        // only update the name if a crc check passes so we're not accidentally reading a stale name
        const storedCrc = new DataView(extra.data.buffer, extra.data.byteOffset).getUint32(1, true);
        const expectCrc = crc32(new Uint8Array(fnData));
        if (storedCrc === expectCrc) {
          entryName = td.decode(extra.data.slice(5));
        }
      }
      // Apply zip64 extended info (extra field 0x0001). Fields are present only when
      // the corresponding 32-bit value is the sentinel 0xFFFFFFFF / 0xFFFF, in order:
      // originalSize, compressedSize, offset, diskStart.
      if (extra.headerId === 0x0001) {
        const z64 = new DataView(extra.data.buffer, extra.data.byteOffset);
        let pos = 0;
        if (entry.originalSize === 0xFFFFFFFF) {
          entry.originalSize = readBigUInt64LE(z64, pos);
          pos += 8;
        }
        if (entry.compressedSize === 0xFFFFFFFF) {
          entry.compressedSize = readBigUInt64LE(z64, pos);
          pos += 8;
        }
        if (entry.offset === 0xFFFFFFFF) {
          entry.offset = readBigUInt64LE(z64, pos);
        }
      }
    });

    entry.name = entryName;
    // entry.name = entryName.replace(/\\/g, '/');
    entry.offset += shift;

    index += 46 + entry.filenameLength + entry.extraLength + entry.commentLength;
    entryTable.set(entry.name, entry);
  }

  return entryTable;
}
