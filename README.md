# @borgar/zip

A library for reading and writing ZIP archives, using native platform APIs for compression where available.

- 🚀 Uses native platform implementations of zlib/deflate where available (which is nearly everywhere!),
  only falling back to JS when all else fails.

- 🧠 Keeps zip compressed in memory, rather than expanding all on load.

- 📦 Reads pretty much any zip file (only known limitation is Zip64 offsets that exceed the largest numbers JS can hold).

- 💬 Fully typed for your convenience.


## Installation

```bash
npm install @borgar/zip
```

## Usage

```js
import { ZipArchive } from '@borgar/zip';

// Read an existing archive
const zip = new ZipArchive(arrayBuffer);
const text = await zip.readText('hello.txt'); // "hello world\n"
const data = await zip.read('image.png'); // ArrayBuffer([ 89 50 4E 47 0D 0A 1A 0A... ])

// Create a new archive
const zip = new ZipArchive();
await zip.write('hello.txt', text);
await zip.write('data.bin', data);
const output = zip.toArrayBuffer();

// Trigger a browser download
const zipBlob = new Blob([ output ]);
const urlObject = URL.createObjectURL(zipBlob);
const a = document.createElement('a');
a.href = urlObject;
a.download = 'MyFilename.zip';
a.click();
URL.revokeObjectURL(urlObject);
```

## API

The API is fully documented in [API.md](API.md).
