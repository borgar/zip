import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { ZipArchive } from '../src/ZipArchive.ts';
import { toArrayBuffer } from '../src/toArrayBuffer.ts';
import { join } from 'node:path';

const FIXTURE_DIR = './test/fixtures';

async function loadZip (fileName: string): Promise<ZipArchive> {
  const bin = await readFile(join(FIXTURE_DIR, fileName));
  return new ZipArchive(toArrayBuffer(bin));
}

function encode (str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

function decode (data?: ArrayBuffer): string | null {
  return data != null ? new TextDecoder().decode(data) : null;
}

describe('fixture tests', () => {
  it('loading a string works', async () => {
    const zip = await loadZip('all.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');

    const zip2 = await loadZip('all.zip');
    expect(await zip2.readText('Hello.txt')).toBe('Hello World\n');

    const zip3 = await loadZip('deflate.zip');
    expect(await zip3.readText('Hello.txt')).toBe('This a looong file : we need to see the difference between the different compression methods.\n');
  });

  it('loading an ArrayBuffer works', async () => {
    const bin = await readFile(join(FIXTURE_DIR, 'all.zip'));
    const zip = new ZipArchive(toArrayBuffer(bin));
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  it('loads files which shadow Object prototype methods', async () => {
    const zip = await loadZip('pollution.zip');
    expect(zip.files).toEqual([ 'toString', '__proto__', 'constructor' ]);
    expect(await zip.readText('toString')).toBe('hello\n');
    expect(await zip.readText('__proto__')).toBe('hello\n');
    expect(await zip.readText('constructor')).toBe('hello\n');
  });

  it('loads files either as strings or arraybuffers', async () => {
    const zip = await loadZip('all.zip');
    const content = 'Hello World\n';
    expect(await zip.readText('Hello.txt')).toBe(content);
    expect(await zip.read('Hello.txt')).toStrictEqual(encode(content));
    const c = await zip.read('Hello.txt');
    expect(c).toStrictEqual(encode(content));
    expect(decode(c)).toBe(content);
  });

  // zip -6 -X deflate.zip Hello.txt
  it('zip with DEFLATE', async () => {
    const zip = await loadZip('deflate.zip');
    expect(await zip.readText('Hello.txt')).toBe(
      'This a looong file : we need to see the difference between the different compression methods.\n',
    );
  });

  // zip -0 -X -z -c archive_comment.zip Hello.txt
  it('read zip with comment', async () => {
    const zip = await loadZip('archive_comment.zip');
    expect(zip.info('Hello.txt')?.comment).toBe('entry comment');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  it.skip('generate zip with comment', async () => {
    type FileContainerComments = (
      ZipArchive & {
        comment?: string,
        setEntryComment: (file: string, comment: string) => Promise<void>
      }
    );
    // This is an un-implemented draft of what a comment interface might look like:
    const zip = new ZipArchive() as FileContainerComments;
    // add comment to the archive
    zip.comment = 'file comment';
    // add comment to an entry
    // await zip.writeFile('Hello.txt', 'Hello World\n', 'utf8', { comment: 'entry comment' });
    // ... maybe there should be a way to add comments to entries without needing to rewrite the whole thing?
    await zip.setEntryComment('Hello.txt', 'entry comment');

    const zip2 = new ZipArchive(zip.toArrayBuffer()) as FileContainerComments;
    expect(zip2.comment).toBe('file comment');
    expect(zip2.info('Hello.txt')?.comment).toBe('entry comment');
  });

  // zip -0 extra_attributes.zip Hello.txt
  it('zip with extra attributes', async () => {
    const zip = await loadZip('extra_attributes.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  // use -fz to force use of Zip64 format
  // zip -fz -0 zip64.zip Hello.txt
  it('zip 64', async () => {
    const zip = await loadZip('zip64.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  // use -fd to force data descriptors as if streaming
  // zip -fd -0 data_descriptor.zip Hello.txt
  it('zip with data descriptor', async () => {
    const zip = await loadZip('data_descriptor.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  // zip -0 -X zip_within_zip.zip Hello.txt && zip -0 -X nested.zip Hello.txt zip_within_zip.zip
  it('nested zip', async () => {
    const zip = await loadZip('nested.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
    const innerBuf = await zip.read('zip_within_zip.zip');
    const inner = new ZipArchive(innerBuf!);
    expect(await inner.readText('Hello.txt')).toBe('Hello World\n');
  });

  // zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
  it('nested zip with data descriptors', async () => {
    const zip = await loadZip('nested_data_descriptor.zip');
    const innerBuf = await zip.read('data_descriptor.zip');
    const inner = new ZipArchive(innerBuf!);
    expect(await inner.readText('Hello.txt')).toBe('Hello World\n');
  });

  // zip -fz -0 nested_zip64.zip zip64.zip
  it('nested zip 64', async () => {
    const zip = await loadZip('nested_zip64.zip');
    const innerBuf = await zip.read('zip64.zip');
    const inner = new ZipArchive(innerBuf!);
    expect(await inner.readText('Hello.txt')).toBe('Hello World\n');
  });

  // zip -X -0 utf8_in_name.zip €15.txt
  it('zip text file with UTF-8 characters in filename', async () => {
    const zip = await loadZip('utf8_in_name.zip');
    expect(zip.files).toContain('€15.txt');
    expect(await zip.readText('€15.txt')).toBe('€15\n');
  });

  // Created with winrar
  it('zip text file with UTF-8 characters in filename (WinRAR)', async () => {
    const zip = await loadZip('winrar_utf8_in_name.zip');
    expect(zip.files).toContain('€15.txt');
    expect(await zip.readText('€15.txt')).toBe('€15\n');
  });

  // zip backslash.zip -0 -X Hel\\lo.txt
  it('zip text file with backslash in filename', async () => {
    const zip = await loadZip('backslash.zip');
    expect(await zip.readText('Hel\\lo.txt')).toBe('Hello World\n');
  });

  // use izarc to generate a zip file on windows
  it.skip('zip text file from windows with \\ in central dir', async () => {
    const zip = await loadZip('slashes_and_izarc.zip');
    expect(await zip.readText('test/Hello.txt')).toBe('Hello world\r\n');
  });

  // cat Hello.txt all.zip > all_prepended_bytes.zip
  it('zip file with prepended bytes', async () => {
    const zip = await loadZip('all_prepended_bytes.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  // cat all.zip Hello.txt > all_appended_bytes.zip
  it('zip file with appended bytes', async () => {
    const zip = await loadZip('all_appended_bytes.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  // cat Hello.txt zip64.zip > zip64_prepended_bytes.zip
  it('zip64 file with prepended bytes', async () => {
    const zip = await loadZip('zip64_prepended_bytes.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  // cat zip64.zip Hello.txt > zip64_appended_bytes.zip
  it('zip64 file with appended bytes', async () => {
    const zip = await loadZip('zip64_appended_bytes.zip');
    expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
  });

  it('loading created files', async () => {
    const zip = new ZipArchive();
    await zip.write('Hello.txt', 'bonjour à tous');
    await zip.write('Bye.txt', 'au revoir');

    const compressed = zip.toArrayBuffer();
    const zip2 = new ZipArchive(compressed);
    zip2.checkCrc = true;

    expect(await zip2.readText('Hello.txt')).toBe('bonjour à tous');
    expect(await zip2.readText('Bye.txt')).toBe('au revoir');
  });

  it('loading overwritten files', async () => {
    const zip = await loadZip('all.zip');
    await zip.write('Hello.txt', 'bonjour à tous');
    await zip.write('Bye.txt', 'au revoir');

    const compressed = zip.toArrayBuffer();
    const zip2 = new ZipArchive(compressed);
    zip2.checkCrc = true;

    expect(await zip2.readText('Hello.txt')).toBe('bonjour à tous');
    expect(await zip2.readText('Bye.txt')).toBe('au revoir');
  });

  describe('unsupported features', () => {
    // zip -0 -X -e encrypted.zip Hello.txt
    it('basic encryption throws', async () => {
      const zip = await loadZip('encrypted.zip');
      await expect(zip.read('Hello.txt')).rejects.toThrow();
    });
  });

  describe('crc32 checks', () => {
    it('valid crc32', async () => {
      const zip = await loadZip('all.zip');
      zip.checkCrc = true;
      expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
    });

    it('invalid crc32 but no check', async () => {
      const zip = await loadZip('invalid/crc32.zip');
      expect(await zip.readText('Hello.txt')).toBe('Hello World\n');
    });

    it('invalid crc32', async () => {
      const zip = await loadZip('invalid/crc32.zip');
      zip.checkCrc = true;
      await expect(zip.read('Hello.txt')).rejects.toThrow();
    });
  });

  describe('corrupted files', () => {
    it('bad compression method throws on read', async () => {
      const zip = await loadZip('invalid/compression.zip');
      await expect(zip.read('Hello.txt')).rejects.toThrow();
    });

    // dd if=all.zip of=all_missing_bytes.zip bs=32 skip=1
    it('zip file with missing bytes throws on load', async () => {
      const bin = await readFile(join(FIXTURE_DIR, 'all_missing_bytes.zip'));
      expect(() => new ZipArchive(toArrayBuffer(bin))).toThrow();
    });

    // dd if=zip64.zip of=zip64_missing_bytes.zip bs=32 skip=1
    it('zip64 file with missing bytes throws on load', async () => {
      const bin = await readFile(join(FIXTURE_DIR, 'zip64_missing_bytes.zip'));
      expect(() => new ZipArchive(toArrayBuffer(bin))).toThrow();
    });

    it('zip file with non-standard extra field loads without throwing', async () => {
      await expect(loadZip('extra_filed_non_standard.zip')).resolves.toBeDefined();
    });

    it('throws for non-zip data', () => {
      const buf = new TextEncoder().encode('this is not a zip file').buffer as ArrayBuffer;
      expect(() => new ZipArchive(buf)).toThrow();
    });

    it('throws for truncated zip data', () => {
      const buf = new TextEncoder().encode('PK\x03\x04\x0A\x00\x00\x00<cut>').buffer as ArrayBuffer;
      expect(() => new ZipArchive(buf)).toThrow();
    });

    it('bad offset throws on read', async () => {
      const zip = await loadZip('invalid/bad_offset.zip');
      await expect(zip.read('Hello.txt')).rejects.toThrow();
    });

    it('bad decompressed size throws on read', async () => {
      const zip = await loadZip('invalid/bad_decompressed_size.zip');
      await expect(zip.read('Hello.txt')).rejects.toThrow();
    });

    it('bad decompressed size, generate a zip', async () => {
      // JSZip throws in this instance, but we do not - instead the added file remains accessible.
      const zip = await loadZip('invalid/bad_decompressed_size.zip');
      zip.checkCrc = true;
      await zip.write('zz', 'zz');

      const zip2 = new ZipArchive(zip.toArrayBuffer());
      zip2.checkCrc = true;
      expect(await zip2.readText('zz')).toBe('zz');
    });
  });

  describe('complex files', () => {
    // http://www.feedbooks.com/book/8/the-metamorphosis
    it('Franz Kafka - The Metamorphosis.epub', async () => {
      const zip = await loadZip('complex_files/Franz Kafka - The Metamorphosis.epub');
      expect(zip.files.length).toBe(26);
      expect(await zip.readText('mimetype')).toBe('application/epub+zip\r\n');
      const main = await zip.readText('OPS/main0.xml');
      expect(main).toContain('One morning, as Gregor Samsa was waking up from anxious dreams');
    });

    // a showcase in http://msdn.microsoft.com/en-us/windows/hardware/gg463429
    it('Outlook2007_Calendar.xps', async () => {
      const zip = await loadZip('complex_files/Outlook2007_Calendar.xps');
      expect(zip.files.length).toBe(15);
      const content = await zip.readText('[Content_Types].xml');
      expect(content).toContain('application/vnd.ms-package.xps-fixeddocument+xml');
    });

    // an example file from http://cheeso.members.winisp.net/srcview.aspx?dir=js-unzip
    it('AntarcticaTemps.xlsx', async () => {
      const zip = await loadZip('complex_files/AntarcticaTemps.xlsx');
      expect(zip.files.length).toBe(17);
      const content = await zip.readText('[Content_Types].xml');
      expect(content).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml');
    });

    it('AntarcticaTemps.ods', async () => {
      const zip = await loadZip('complex_files/AntarcticaTemps.ods');
      expect(zip.files.length).toBe(20);
      const content = await zip.readText('META-INF/manifest.xml');
      expect(content).toContain('application/vnd.oasis.opendocument.spreadsheet');
    });
  });
});
