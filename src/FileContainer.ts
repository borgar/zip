import { buildEntryHeader } from './buildEntryHeader.ts';
import { buildLocalHeader } from './buildLocalHeader.ts';
import { buildMainHeader } from './buildMainHeader.ts';
import { crc32 } from './crc32.ts';
import { dateToDos, dosToDate } from './dosTime.ts';
import { getDeflate } from './getDeflate.ts';
import { getInflate } from './getInflate.ts';
import type { ArchEntry } from './loadEntryHeader.ts';
import { loadLocalHeader } from './loadLocalHeader.ts';
import { zipIndex } from './zipIndex.ts';

export class FileContainer {
  private index: Map<string, ArchEntry>;
  private archive: ArrayBuffer;
  allowZlib: boolean = true;
  allowStreams: boolean = true;
  checkCrc: boolean = false;

  constructor (archive?: ArrayBuffer) {
    if (archive) {
      this.index = zipIndex(archive);
      this.archive = archive;
    }
    else {
      this.index = new Map();
      this.archive = new ArrayBuffer(40);
    }
  }

  async readFile (name: string, mode: 'utf8'): Promise<string | null>;
  async readFile (name: string, mode?: 'binary'): Promise<ArrayBuffer | null>;
  async readFile (name: string, mode: 'utf8' | 'binary'): Promise<string | ArrayBuffer | null>;
  async readFile (name: string, mode: 'utf8' | 'binary' = 'binary'): Promise<string | ArrayBuffer | null> {
    const normName = name.replace(/^\.\//g, '');
    const fd = this.index.get(normName);
    if (!fd) {
      return null;
    }
    const isEncrypted = fd.flags & 0x001;
    if (isEncrypted) {
      throw new Error('Encrypted files cannot be read');
    }

    const { offset, compressedSize, crc } = fd;
    const hd = loadLocalHeader(new DataView(this.archive, offset, 30));
    const dataOffset = offset + 30 + hd.filenameLength + hd.extraLength;
    let uncompressed: ArrayBuffer;
    if (fd.method === 8) {
      uncompressed = await getInflate(this.allowStreams, this.allowZlib)(
        this.archive.slice(dataOffset, dataOffset + compressedSize),
      );
    }
    else if (fd.method === 0) {
      uncompressed = this.archive.slice(dataOffset, dataOffset + compressedSize);
    }
    else {
      throw new Error('Unsupported compression method: ' + fd.method);
    }
    if (this.checkCrc) {
      const outputCrc = crc32(new Uint8Array(uncompressed));
      if (outputCrc !== crc) {
        throw new Error('Corrupted file: CRC check failed');
      }
    }
    if (fd.originalSize !== uncompressed.byteLength) {
      throw new Error('Corrupted file: Size mismatch');
    }
    return mode === 'binary'
      ? uncompressed
      : new TextDecoder().decode(uncompressed);
  }

  async writeFile (name: string, data: string, mode?: 'utf8'): Promise<void>;
  async writeFile (name: string, data: ArrayBuffer, mode?: 'binary'): Promise<void>;
  async writeFile (name: string, data: string | ArrayBuffer, mode?: 'utf8' | 'binary'): Promise<void> {
    const normName = name.replace(/^\.\//g, '');
    const raw: ArrayBuffer = (typeof data === 'string' || mode === 'utf8')
      ? new TextEncoder().encode(data as string).buffer as ArrayBuffer
      : data;

    const checksum = crc32(new Uint8Array(raw));
    const compressed = await getDeflate(this.allowStreams, this.allowZlib)(raw);
    const isSmaller = compressed.byteLength < raw.byteLength;
    const fileData = isSmaller ? compressed : raw;
    const method = isSmaller ? 8 : 0;
    const mtime = dateToDos(new Date());
    const nameBytes = new TextEncoder().encode(normName);

    // Collect existing local entries (excluding any being replaced)
    const localChunks: ArrayBuffer[] = [];
    const entries: { entry: ArchEntry, localOffset: number }[] = [];
    let localOffset = 0;

    for (const [ entryName, entry ] of this.index.entries()) {
      if (entryName === normName) { continue; }
      const locHd = loadLocalHeader(new DataView(this.archive, entry.offset, 30));
      const localSize = 30 + locHd.filenameLength + locHd.extraLength + entry.compressedSize;
      localChunks.push(this.archive.slice(entry.offset, entry.offset + localSize));
      entries.push({ entry, localOffset });
      localOffset += localSize;
    }

    // Append new local entry
    const newEntry: ArchEntry = {
      name: normName,
      comment: '',
      headerSize: 46,
      filenameLength: nameBytes.byteLength,
      extraLength: 0,
      commentLength: 0,
      versionMadeBy: 20,
      version: 20,
      flags: 0, // XXX: maybe set 0x800 to indicate utf8?
      method,
      mtime,
      crc: checksum,
      compressedSize: fileData.byteLength,
      originalSize: raw.byteLength,
      diskStart: 0,
      iattr: 0,
      attr: 0,
      offset: localOffset,
      extra: [],
    };
    localChunks.push(
      buildLocalHeader({
        method,
        mtime,
        crc: checksum,
        compressedSize: fileData.byteLength,
        originalSize: raw.byteLength,
        filenameLength: nameBytes.byteLength,
      }),
      nameBytes.buffer as ArrayBuffer,
      fileData,
    );
    entries.push({ entry: newEntry, localOffset });
    localOffset += 30 + nameBytes.byteLength + fileData.byteLength;

    // Central directory
    const cdChunks: ArrayBuffer[] = [];
    for (const { entry, localOffset: entryOffset } of entries) {
      const en = new TextEncoder().encode(entry.name);
      cdChunks.push(buildEntryHeader(entry, entryOffset, en), en.buffer as ArrayBuffer);
    }
    const cdSize = cdChunks.reduce((sum, c) => sum + c.byteLength, 0);

    // Assemble
    const all = [ ...localChunks, ...cdChunks, buildMainHeader(entries.length, cdSize, localOffset) ];
    const totalSize = all.reduce((sum, c) => sum + c.byteLength, 0);
    const out = new Uint8Array(totalSize);
    let pos = 0;
    for (const chunk of all) {
      out.set(new Uint8Array(chunk), pos);
      pos += chunk.byteLength;
    }

    this.archive = out.buffer as ArrayBuffer;
    this.index = zipIndex(this.archive);
  }

  stat (name: string) {
    const normName = name.replace(/^\.\//g, '');
    const local = this.index.get(normName);
    if (!local) {
      return undefined;
    }
    return {
      name: normName,
      isDir: name.endsWith('/'),
      comment: local.comment,
      size: local.originalSize,
      mtime: dosToDate(local.mtime),
      crc: local.crc,
    };
  }

  hasFile (name: string): boolean {
    // The convention is to detemine if something is a directory by a trailing slash
    // when this is the case, we don't report true as if the name is a file.
    if (!name.endsWith('/')) {
      return this.hasEntry(name);
    }
    return false;
  }

  hasEntry (name: string): boolean {
    return this.index.has(name.replace(/^\.\//g, ''));
  }

  get files (): string[] {
    return [ ...this.index.keys() ];
  }

  toArrayBuffer (): ArrayBuffer {
    return this.archive;
  }
}
