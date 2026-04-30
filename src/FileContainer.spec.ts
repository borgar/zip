import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it } from 'vitest';
import { FileContainer } from './FileContainer.ts';
import { crc32 } from './crc32.ts';
import { toArrayBuffer } from './toArrayBuffer.ts';

async function loadFixture (name: string): Promise<ArrayBuffer> {
  return toArrayBuffer(await readFile(`./test/fixtures/${name}`));
}

describe('FileContainer', () => {
  describe('constructor', () => {
    it('creates an empty container when called without arguments', () => {
      const zip = new FileContainer();
      expect(zip.files).toEqual([]);
    });

    it('parses a valid archive', async () => {
      const zip = new FileContainer(await loadFixture('store.zip'));
      expect(zip.files).toEqual([ 'Hello.txt' ]);
    });

    it('throws for invalid archive data', () => {
      const buf = new TextEncoder().encode('not a zip').buffer as ArrayBuffer;
      expect(() => new FileContainer(buf)).toThrow('Invalid archive format');
    });
  });

  describe('files', () => {
    it('returns an empty array for a new container', () => {
      expect(new FileContainer().files).toEqual([]);
    });

    it('lists names from a fixture archive', async () => {
      const zip = new FileContainer(await loadFixture('store.zip'));
      expect(zip.files).toEqual([ 'Hello.txt' ]);
    });

    it('includes directory entries', async () => {
      const zip = new FileContainer(await loadFixture('folder.zip'));
      expect(zip.files).toContain('folder/');
    });
  });

  describe('hasFile', () => {
    let zip: FileContainer;

    beforeEach(() => { zip = new FileContainer(); });

    it('returns true for an existing file', async () => {
      await zip.writeFile('a.txt', 'hi');
      expect(zip.hasFile('a.txt')).toBe(true);
    });

    it('returns false for a missing file', () => {
      expect(zip.hasFile('nope.txt')).toBe(false);
    });

    it('returns false for a directory entry (trailing slash)', async () => {
      await zip.writeFile('dir/', '');
      expect(zip.hasFile('dir/')).toBe(false);
    });
  });

  describe('hasEntry', () => {
    it('returns true for files', async () => {
      const zip = new FileContainer();
      await zip.writeFile('file.txt', 'x');
      expect(zip.hasEntry('file.txt')).toBe(true);
    });

    it('returns true for directory entries', async () => {
      const zip = new FileContainer(await loadFixture('folder.zip'));
      expect(zip.hasEntry('folder/')).toBe(true);
    });

    it('returns false for missing entries', () => {
      expect(new FileContainer().hasEntry('missing')).toBe(false);
    });
  });

  describe('readFile', () => {
    let zip: FileContainer;

    beforeEach(async () => {
      zip = new FileContainer();
      await zip.writeFile('hello.txt', 'hello world');
    });

    it('returns null for a missing file', async () => {
      expect(await zip.readFile('missing.txt')).toBeNull();
    });

    it('reads a file as a utf8 string', async () => {
      expect(await zip.readFile('hello.txt', 'utf8')).toBe('hello world');
    });

    it('reads a file as an ArrayBuffer by default', async () => {
      const result = await zip.readFile('hello.txt');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(result!)).toBe('hello world');
    });

    it('normalises a leading ./ in the filename', async () => {
      expect(await zip.readFile('./hello.txt', 'utf8')).toBe('hello world');
    });

    it('reads a stored (method 0) file from a fixture', async () => {
      const stored = new FileContainer(await loadFixture('store.zip'));
      const result = await stored.readFile('Hello.txt');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result?.byteLength).toBe(94);
    });

    it('reads a deflated (method 8) file from a fixture', async () => {
      const deflated = new FileContainer(await loadFixture('deflate.zip'));
      const result = await deflated.readFile('Hello.txt');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result?.byteLength).toBe(94);
    });
  });

  describe('writeFile', () => {
    it('adds a new file from a string', async () => {
      const zip = new FileContainer();
      await zip.writeFile('note.txt', 'content');
      expect(zip.hasFile('note.txt')).toBe(true);
      expect(await zip.readFile('note.txt', 'utf8')).toBe('content');
    });

    it('adds a new file from an ArrayBuffer', async () => {
      const zip = new FileContainer();
      const data = new Uint8Array([ 0xDE, 0xAD, 0xBE, 0xEF ]).buffer as ArrayBuffer;
      await zip.writeFile('data.bin', data);
      const result = await zip.readFile('data.bin');
      expect(new Uint8Array(result!)).toEqual(new Uint8Array([ 0xDE, 0xAD, 0xBE, 0xEF ]));
    });

    it('replaces an existing file and leaves only one copy', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'original');
      await zip.writeFile('a.txt', 'replaced');
      expect(await zip.readFile('a.txt', 'utf8')).toBe('replaced');
      expect(zip.files.filter(f => f === 'a.txt')).toHaveLength(1);
    });

    it('preserves other files when adding a new file', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'aaa');
      await zip.writeFile('b.txt', 'bbb');
      expect(await zip.readFile('a.txt', 'utf8')).toBe('aaa');
      expect(await zip.readFile('b.txt', 'utf8')).toBe('bbb');
    });

    it('preserves other files when replacing an existing file', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'aaa');
      await zip.writeFile('b.txt', 'bbb');
      await zip.writeFile('a.txt', 'new-aaa');
      expect(await zip.readFile('a.txt', 'utf8')).toBe('new-aaa');
      expect(await zip.readFile('b.txt', 'utf8')).toBe('bbb');
    });

    it('produces a valid archive that survives a full parse roundtrip', async () => {
      const zip = new FileContainer();
      await zip.writeFile('test.txt', 'roundtrip content');
      const zip2 = new FileContainer(zip.toArrayBuffer());
      expect(await zip2.readFile('test.txt', 'utf8')).toBe('roundtrip content');
    });

    it('normalises a leading ./ in the filename', async () => {
      const zip = new FileContainer();
      await zip.writeFile('./notes.txt', 'hi');
      expect(zip.hasFile('notes.txt')).toBe(true);
      expect(await zip.readFile('notes.txt', 'utf8')).toBe('hi');
    });

    it('can add files to an existing archive from a fixture', async () => {
      const zip = new FileContainer(await loadFixture('store.zip'));
      await zip.writeFile('added.txt', 'new content');
      expect(zip.files).toContain('Hello.txt');
      expect(zip.files).toContain('added.txt');
      expect(await zip.readFile('added.txt', 'utf8')).toBe('new content');
    });
  });

  describe('stat', () => {
    it('returns undefined for a missing entry', () => {
      expect(new FileContainer().stat('nope.txt')).toBeUndefined();
    });

    it('returns the normalised name', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'hello');
      expect(zip.stat('a.txt')?.name).toBe('a.txt');
    });

    it('normalises a leading ./ in the name', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'hello');
      expect(zip.stat('./a.txt')?.name).toBe('a.txt');
    });

    it('returns the uncompressed size', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'hello');
      expect(zip.stat('a.txt')?.size).toBe(5);
    });

    it('returns mtime as a Date', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'hello');
      expect(zip.stat('a.txt')?.mtime).toBeInstanceOf(Date);
    });

    it('returns the CRC32 of the file content', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'hello');
      expect(zip.stat('a.txt')?.crc).toBe(crc32(new TextEncoder().encode('hello')));
    });

    it('returns an empty comment for written files', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'hello');
      expect(zip.stat('a.txt')?.comment).toBe('');
    });

    it('returns isDir false for a regular file', async () => {
      const zip = new FileContainer();
      await zip.writeFile('a.txt', 'hello');
      expect(zip.stat('a.txt')?.isDir).toBe(false);
    });

    it('returns isDir true for a directory entry', async () => {
      const zip = new FileContainer(await loadFixture('folder.zip'));
      expect(zip.stat('folder/')?.isDir).toBe(true);
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
          const zip = new FileContainer(await loadFixture('deflate.zip'));
          zip.allowZlib = allowZlib;
          zip.allowStreams = allowStreams;
          const result = await zip.readFile('Hello.txt');
          expect(result).toBeInstanceOf(ArrayBuffer);
          expect(result?.byteLength).toBe(94);
        });

        it('write+read roundtrip with compressible content', async () => {
          const zip = new FileContainer();
          zip.allowZlib = allowZlib;
          zip.allowStreams = allowStreams;
          const content = 'hello world '.repeat(20);
          await zip.writeFile('test.txt', content);
          expect(await zip.readFile('test.txt', 'utf8')).toBe(content);
        });
      });
    }
  });

  describe('toArrayBuffer', () => {
    it('returns an ArrayBuffer', () => {
      expect(new FileContainer().toArrayBuffer()).toBeInstanceOf(ArrayBuffer);
    });

    it('produces an archive that can be re-parsed', async () => {
      const zip = new FileContainer();
      await zip.writeFile('foo.txt', 'foo');
      const zip2 = new FileContainer(zip.toArrayBuffer());
      expect(await zip2.readFile('foo.txt', 'utf8')).toBe('foo');
    });
  });
});
