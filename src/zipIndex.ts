import { PK56, PK66, PK67 } from './constants.ts';
import { loadEntryHeader, type ArchEntry } from './loadEntryHeader.ts';
import { loadMainHeader } from './loadMainHeader.ts';
import { readBigUInt64LE } from './readBigUInt64LE.ts';

export function zipIndex (data: ArrayBuffer): Record<string, ArchEntry> {
  const entryTable: Record<string, ArchEntry> = {};
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
      n = i - 20;
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
  if (mainHeader.volumeEntries > (dataView.byteLength - mainHeader.offset) / 46) {
    throw new Error('Disk entry too large');
  }

  const entriesLength = mainHeader.volumeEntries;
  let index = mainHeader.offset; // offset of first CEN header

  const td = new TextDecoder();
  for (i = 0; i < entriesLength; i++) {
    const entry = loadEntryHeader(new DataView(data, index, 46));

    const fnStart = index + 46;
    const fnData = data.slice(fnStart, fnStart + entry.filenameLength);
    entry.name = td.decode(fnData);

    const cStart = index + 46 + entry.filenameLength + entry.extraLength;
    const cData = data.slice(cStart, cStart + entry.commentLength);
    entry.comment = td.decode(cData);

    index += 46 + entry.filenameLength + entry.extraLength + entry.commentLength;
    entryTable[entry.name] = entry;
  }

  return entryTable;
}
