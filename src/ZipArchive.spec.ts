import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZipArchive } from './ZipArchive.ts';
import { Z_DEFLATE, Z_STORE } from './constants.ts';
import { crc32 } from './crc32.ts';
import { toArrayBuffer } from './toArrayBuffer.ts';

async function loadFixture (name: string): Promise<ArrayBuffer> {
  return toArrayBuffer(await readFile(`./test/fixtures/${name}`));
}

describe('FileContainer', () => {
  describe('constructor', () => {
    it('creates an empty container when called without arguments', () => {
      const zip = new ZipArchive();
      expect(zip.files).toEqual([]);
    });

    it('parses a valid archive', async () => {
      const zip = new ZipArchive(await loadFixture('store.zip'));
      expect(zip.files).toEqual([ 'Hello.txt' ]);
    });

    it('throws for invalid archive data', () => {
      const buf = new TextEncoder().encode('not a zip').buffer as ArrayBuffer;
      expect(() => new ZipArchive(buf)).toThrow('Invalid archive format');
    });
  });

  describe('files', () => {
    it('returns an empty array for a new container', () => {
      expect(new ZipArchive().files).toEqual([]);
    });

    it('lists names from a fixture archive', async () => {
      const zip = new ZipArchive(await loadFixture('store.zip'));
      expect(zip.files).toEqual([ 'Hello.txt' ]);
    });

    it('includes directory entries', async () => {
      const zip = new ZipArchive(await loadFixture('folder.zip'));
      expect(zip.files).toContain('folder/');
    });
  });

  describe('hasEntry', () => {
    it('returns true for files', async () => {
      const zip = new ZipArchive();
      await zip.write('file.txt', 'x');
      expect(zip.has('file.txt')).toBe(true);
    });

    it('returns true for directory entries', async () => {
      const zip = new ZipArchive(await loadFixture('folder.zip'));
      expect(zip.has('folder/')).toBe(true);
    });

    it('returns false for missing entries', () => {
      expect(new ZipArchive().has('missing')).toBe(false);
    });
  });

  describe('readFile', () => {
    let zip: ZipArchive;

    beforeEach(async () => {
      zip = new ZipArchive();
      await zip.write('hello.txt', 'hello world');
    });

    it('returns null for a missing file', async () => {
      expect(await zip.read('missing.txt')).toBeNull();
    });

    it('reads a file as a utf8 string', async () => {
      expect(await zip.readText('hello.txt')).toBe('hello world');
    });

    it('reads a file as an ArrayBuffer by default', async () => {
      const result = await zip.read('hello.txt');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(result!)).toBe('hello world');
    });

    it('normalises a leading ./ in the filename', async () => {
      expect(await zip.readText('./hello.txt')).toBe('hello world');
    });

    it('reads a stored (method 0) file from a fixture', async () => {
      const stored = new ZipArchive(await loadFixture('store.zip'));
      const result = await stored.read('Hello.txt');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result?.byteLength).toBe(94);
    });

    it('reads a deflated (method 8) file from a fixture', async () => {
      const deflated = new ZipArchive(await loadFixture('deflate.zip'));
      const result = await deflated.read('Hello.txt');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result?.byteLength).toBe(94);
    });
  });

  describe('writeFile', () => {
    it('adds a new file from a string', async () => {
      const zip = new ZipArchive();
      await zip.write('note.txt', 'content');
      expect(zip.has('note.txt')).toBe(true);
      expect(await zip.readText('note.txt')).toBe('content');
    });

    it('adds a new file from an ArrayBuffer', async () => {
      const zip = new ZipArchive();
      const data = new Uint8Array([ 0xDE, 0xAD, 0xBE, 0xEF ]).buffer as ArrayBuffer;
      await zip.write('data.bin', data);
      const result = await zip.read('data.bin');
      expect(new Uint8Array(result!)).toEqual(new Uint8Array([ 0xDE, 0xAD, 0xBE, 0xEF ]));
    });

    it('replaces an existing file and leaves only one copy', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'original');
      await zip.write('a.txt', 'replaced');
      expect(await zip.readText('a.txt')).toBe('replaced');
      expect(zip.files.filter(f => f === 'a.txt')).toHaveLength(1);
    });

    it('preserves other files when adding a new file', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'aaa');
      await zip.write('b.txt', 'bbb');
      expect(await zip.readText('a.txt')).toBe('aaa');
      expect(await zip.readText('b.txt')).toBe('bbb');
    });

    it('preserves other files when replacing an existing file', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'aaa');
      await zip.write('b.txt', 'bbb');
      await zip.write('a.txt', 'new-aaa');
      expect(await zip.readText('a.txt')).toBe('new-aaa');
      expect(await zip.readText('b.txt')).toBe('bbb');
    });

    it('produces a valid archive that survives a full parse roundtrip', async () => {
      const zip = new ZipArchive();
      await zip.write('test.txt', 'roundtrip content');
      const zip2 = new ZipArchive(zip.toArrayBuffer());
      expect(await zip2.readText('test.txt')).toBe('roundtrip content');
    });

    it('normalises a leading ./ in the filename', async () => {
      const zip = new ZipArchive();
      await zip.write('./notes.txt', 'hi');
      expect(zip.has('notes.txt')).toBe(true);
      expect(await zip.readText('notes.txt')).toBe('hi');
    });

    it('can add files to an existing archive from a fixture', async () => {
      const zip = new ZipArchive(await loadFixture('store.zip'));
      await zip.write('added.txt', 'new content');
      expect(zip.files).toContain('Hello.txt');
      expect(zip.files).toContain('added.txt');
      expect(await zip.readText('added.txt')).toBe('new content');
    });

    describe('compression mode', () => {
      const compressible = 'hello world '.repeat(20);
      const incompressible = new Uint8Array(Array.from({ length: 64 }, (_, i) => i)).buffer as ArrayBuffer;

      it('ZMODE_STORE forces store (method 0) regardless of compressibility', async () => {
        const zip = new ZipArchive();
        await zip.write('test.txt', compressible, Z_STORE);
        const archiveSize = zip.toArrayBuffer().byteLength;
        const rawSize = new TextEncoder().encode(compressible).byteLength;
        expect(archiveSize).toBeGreaterThanOrEqual(rawSize);
        expect(await zip.readText('test.txt')).toBe(compressible);
      });

      it('ZMODE_STORE roundtrip preserves exact bytes for binary data', async () => {
        const zip = new ZipArchive();
        await zip.write('data.bin', incompressible, Z_STORE);
        const result = await zip.read('data.bin');
        expect(new Uint8Array(result!)).toEqual(new Uint8Array(incompressible));
      });

      it('ZMODE_DEFLATE compresses compressible content', async () => {
        const zip = new ZipArchive();
        await zip.write('test.txt', compressible, Z_DEFLATE);
        const archiveSize = zip.toArrayBuffer().byteLength;
        const rawSize = new TextEncoder().encode(compressible).byteLength;
        expect(archiveSize).toBeLessThan(rawSize);
        expect(await zip.readText('test.txt')).toBe(compressible);
      });

      it('ZMODE_DEFLATE falls back to store when deflate would be larger', async () => {
        const zip = new ZipArchive();
        await zip.write('data.bin', incompressible, Z_DEFLATE);
        // Archive size must not exceed raw size by more than header overhead
        const archiveSize = zip.toArrayBuffer().byteLength;
        const rawSize = incompressible.byteLength;
        expect(archiveSize).toBeLessThan(rawSize + 200);
        const result = await zip.read('data.bin');
        expect(new Uint8Array(result!)).toEqual(new Uint8Array(incompressible));
      });

      it('default mode (no argument) behaves like ZMODE_DEFLATE', async () => {
        const withDefault = new ZipArchive();
        const withExplicit = new ZipArchive();
        await withDefault.write('test.txt', compressible);
        await withExplicit.write('test.txt', compressible, Z_DEFLATE);
        expect(withDefault.toArrayBuffer().byteLength).toBe(withExplicit.toArrayBuffer().byteLength);
      });
    });
  });

  describe('stat', () => {
    it('returns undefined for a missing entry', () => {
      expect(new ZipArchive().info('nope.txt')).toBeUndefined();
    });

    it('returns the normalised name', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'hello');
      expect(zip.info('a.txt')?.name).toBe('a.txt');
    });

    it('normalises a leading ./ in the name', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'hello');
      expect(zip.info('./a.txt')?.name).toBe('a.txt');
    });

    it('returns the uncompressed size', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'hello');
      expect(zip.info('a.txt')?.size).toBe(5);
    });

    it('returns mtime as a Date', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'hello');
      expect(zip.info('a.txt')?.mtime).toBeInstanceOf(Date);
    });

    it('returns the CRC32 of the file content', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'hello');
      expect(zip.info('a.txt')?.crc).toBe(crc32(new TextEncoder().encode('hello')));
    });

    it('returns an empty comment for written files', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'hello');
      expect(zip.info('a.txt')?.comment).toBe('');
    });

    it('returns isDir false for a regular file', async () => {
      const zip = new ZipArchive();
      await zip.write('a.txt', 'hello');
      expect(zip.info('a.txt')?.isDir).toBe(false);
    });

    it('returns isDir true for a directory entry', async () => {
      const zip = new ZipArchive(await loadFixture('folder.zip'));
      expect(zip.info('folder/')?.isDir).toBe(true);
    });
  });

  describe('compression backends', () => {
    const combos = [
      { allowZlib: false, allowStreams: false },
      { allowZlib: true, allowStreams: false },
      { allowZlib: false, allowStreams: true },
      { allowZlib: true, allowStreams: true },
    ];

    for (const { allowZlib, allowStreams } of combos) {
      describe(`allowZlib=${allowZlib} allowStreams=${allowStreams}`, () => {
        it('reads a deflated fixture', async () => {
          const zip = new ZipArchive(await loadFixture('deflate.zip'));
          zip.allowZlib = allowZlib;
          zip.allowStreams = allowStreams;
          const result = await zip.read('Hello.txt');
          expect(result).toBeInstanceOf(ArrayBuffer);
          expect(result?.byteLength).toBe(94);
        });

        it('write+read roundtrip with compressible content', async () => {
          const zip = new ZipArchive();
          zip.allowZlib = allowZlib;
          zip.allowStreams = allowStreams;
          const content = 'hello world '.repeat(20);
          await zip.write('test.txt', content);
          expect(await zip.readText('test.txt')).toBe(content);
        });
      });
    }
  });

  describe('toArrayBuffer', () => {
    it('returns an ArrayBuffer', () => {
      expect(new ZipArchive().toArrayBuffer()).toBeInstanceOf(ArrayBuffer);
    });

    it('produces an archive that can be re-parsed', async () => {
      const zip = new ZipArchive();
      await zip.write('foo.txt', 'foo');
      const zip2 = new ZipArchive(zip.toArrayBuffer());
      expect(await zip2.readText('foo.txt')).toBe('foo');
    });
  });
});
