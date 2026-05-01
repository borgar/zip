import { buildEntryHeader } from './buildEntryHeader.ts';
import { buildLocalHeader } from './buildLocalHeader.ts';
import { buildMainHeader } from './buildMainHeader.ts';
import type { ZMode } from './constants.ts';
import { crc32 } from './crc32.ts';
import { dateToDos, dosToDate } from './dosTime.ts';
import { getDeflate } from './getDeflate.ts';
import { getInflate } from './getInflate.ts';
import type { ArchEntry } from './loadEntryHeader.ts';
import { loadLocalHeader } from './loadLocalHeader.ts';
import { zipIndex } from './zipIndex.ts';

/** Metadata returned by {@link ZipArchive.info}. */
export type ZipEntryInfo = {
  /**
   * Entry name/path.
   */
  name: string,
  /**
   * `true` if the entry is a directory.
   */
  isDir: boolean,
  /**
   * Entry comment string, or an empty string if none.
   */
  comment: string,
  /**
   * Uncompressed size in bytes.
   */
  size: number,
  /**
   * Last-modified time.
   */
  mtime: Date,
  /**
   * CRC-32 checksum of the uncompressed content.
   */
  crc: number,
};

/**
 * Reads and writes ZIP archives.
 */
export class ZipArchive {
  private index: Map<string, ArchEntry>;
  private archive: ArrayBuffer;
  /**
   * Permit using `node:zlib` for deflate compression/decompression when available.
   */
  allowZlib: boolean = true;
  /**
   * Permit using the `CompressionStream` API for deflate compression/decompression when available.
   */
  allowStreams: boolean = true;
  /**
   * Verify CRC32 checksums when reading files. Will cause a throws on a mismatch.
   * By default checksums are ignored.
   */
  checkCrc: boolean = false;

  /**
   * Creates a new container.
   * Pass an existing ZIP `ArrayBuffer` to parse it, or omit to start an empty archive.
   */
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

  /**
   * Reads a file from the archive. Returns `undefined` if the file does not exist.
   *
   * @param path The filename or path of the entry to read.
   * @param encoding Set the encoding of the return data.
   * @returns The entry's data in an ArrayBuffer` or undefined if the entry does not exist.
   * @throws if the file is encrypted or uses an unsupported compression method.
   */
  async read (path: string): Promise<ArrayBuffer | undefined> {
    const normName = path.replace(/^\.\//g, '');
    const fd = this.index.get(normName);
    if (!fd) {
      return;
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
    return uncompressed;
  }

  /**
   * Reads a textfile from the archive. Returns `undefined` if the file does not exist.
   *
   * @param path The filename or path of the entry to read.
   * @returns The entry's data as a string.
   * @throws if the file is encrypted or uses an unsupported compression method.
   */
  async readText (path: string): Promise<string | undefined> {
    const data = await this.read(path);
    return data && new TextDecoder().decode(data);
  }

  /**
   * Adds or replaces a file in the archive.
   *
   * @param path The filename or path of the entry to write.
   * @param data The data to add to the archive.
   * @param mode Compression mode. Defaults to `ZMODE_DEFLATE` (8), which applies deflate compression
   *   when it reduces the file size and falls back to store otherwise. Pass `ZMODE_STORE` (0) to
   *   store without compression.
   */
  async write (path: string, data: string | ArrayBuffer, mode?: ZMode) {
    const normName = path.replace(/^\.\//g, '');
    const raw: ArrayBuffer = (typeof data === 'string')
      ? new TextEncoder().encode(data as string).buffer as ArrayBuffer
      : data;

    let fileData = raw;
    let method = mode === 'store' ? 0 : 8;
    if (method === 8) {
      const compressed = await getDeflate(this.allowStreams, this.allowZlib)(raw);
      if (compressed.byteLength < raw.byteLength) {
        fileData = compressed;
      }
      else {
        method = 0;
      }
    }
    const checksum = crc32(new Uint8Array(raw));
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
      flags: 0x800,
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
      buildLocalHeader(newEntry),
      nameBytes.buffer,
      fileData,
    );
    entries.push({ entry: newEntry, localOffset });
    localOffset += 30 + nameBytes.byteLength + fileData.byteLength;

    // Central directory
    const cdChunks: ArrayBuffer[] = [];
    for (const { entry, localOffset: entryOffset } of entries) {
      const en = new TextEncoder().encode(entry.name);
      cdChunks.push(buildEntryHeader(entry, entryOffset, en), en.buffer);
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

    this.archive = out.buffer;
    this.index = zipIndex(this.archive);
  }

  /**
   * Removes an entry from the archive.
   *
   * @param path The filename or path of the entry to remove.
   * @returns `true` if the entry was found and removed, `false` if it did not exist.
   */
  delete (path: string): boolean {
    const normName = path.replace(/^\.\//g, '');
    if (!this.index.has(normName)) {
      return false;
    }

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

    const cdChunks: ArrayBuffer[] = [];
    for (const { entry, localOffset: entryOffset } of entries) {
      const en = new TextEncoder().encode(entry.name);
      cdChunks.push(buildEntryHeader(entry, entryOffset, en), en.buffer);
    }
    const cdSize = cdChunks.reduce((sum, c) => sum + c.byteLength, 0);

    const all = [ ...localChunks, ...cdChunks, buildMainHeader(entries.length, cdSize, localOffset) ];
    const totalSize = all.reduce((sum, c) => sum + c.byteLength, 0);
    const out = new Uint8Array(totalSize);
    let pos = 0;
    for (const chunk of all) {
      out.set(new Uint8Array(chunk), pos);
      pos += chunk.byteLength;
    }

    this.archive = out.buffer;
    this.index = zipIndex(this.archive);
    return true;
  }

  /**
   * Returns metadata for a file, or `undefined` if it does not exist.
   *
   * @param path The filename or path of the entry to read.
   * @returns An info entry for the given entitiy, or `undefined` if entitiy does not exist.
  */
  info (path: string): ZipEntryInfo | undefined {
    const normName = path.replace(/^\.\//g, '');
    const local = this.index.get(normName);
    if (!local) {
      return undefined;
    }
    return {
      name: normName,
      isDir: path.endsWith('/'),
      comment: local.comment,
      size: local.originalSize,
      mtime: dosToDate(local.mtime),
      crc: local.crc,
    };
  }

  /**
   * Returns `true` if any entry (file or directory) with that name exists.
   * @param path The filename or path of the entry to read.
   */
  has (path: string): boolean {
    return this.index.has(path.replace(/^\.\//g, ''));
  }

  /**
   * Array of all entry names (files and directories) in the archive.
   */
  get files (): string[] {
    return [ ...this.index.keys() ];
  }

  /**
   * Serialises the archive to an `ArrayBuffer`.
   */
  toArrayBuffer (): ArrayBuffer {
    return this.archive;
  }
}
