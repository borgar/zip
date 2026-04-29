import { getInflate } from './getInflate.ts';
import type { ArchEntry } from './loadEntryHeader.ts';
import { loadLocalHeader } from './loadLocalHeader.ts';
import { zipIndex } from './zipIndex.ts';

export class FileContainer {
  private index: Record<string, ArchEntry>;
  private archive: ArrayBuffer;
  allowZlib: boolean = true;
  allowStreams: boolean = true;

  constructor (archive?: ArrayBuffer) {
    if (archive) {
      try {
        this.index = zipIndex(archive);
        this.archive = archive;
      }
      catch (err) {
        // eslint-disable-next-line preserve-caught-error
        throw new Error('Invalid zip file');
      }
    }
    else {
      this.index = {};
      this.archive = new ArrayBuffer(40);
    }
  }

  async readFile (name: string, mode: 'utf8'): Promise<string | null>;
  async readFile (name: string, mode?: 'binary'): Promise<ArrayBuffer | null>;
  async readFile (name: string, mode: 'utf8' | 'binary' = 'binary'): Promise<string | ArrayBuffer | null> {
    const normName = name.replace(/^\.\//g, '');
    const fd = this.index[normName];
    if (!fd) {
      return null;
    }
    const { offset, compressedSize } = fd;
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
    return mode === 'binary'
      ? uncompressed
      : new TextDecoder().decode(uncompressed);
  }

  stat (name: string) {
    const normName = name.replace(/^\.\//g, '');
    const local = this.index[normName];
    // return ;
    return {
      // comment
      //
      size: local.originalSize,
      mtime: local.mtime,
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
    return name.replace(/^\.\//g, '') in this.index;
  }

  get files (): string[] {
    return Object.keys(this.index);
  }
}
