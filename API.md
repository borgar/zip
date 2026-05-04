
<a name="readmemd"></a>

# @borgar/zip

## Classes

- [ZipArchive](#classesziparchivemd)

## Type Aliases

- [ZipEntryInfo](#type-aliaseszipentryinfomd)
- [ZMode](#type-aliaseszmodemd)

## Variables

- [Z\_DEFLATE](#variablesz_deflatemd)
- [Z\_STORE](#variablesz_storemd)


<a name="classesziparchivemd"></a>

# ZipArchive

Reads and writes ZIP archives.

## Constructors

### Constructor

```ts
new ZipArchive(archive?: ArrayBuffer): ZipArchive;
```

Creates a new container.
Pass an existing ZIP `ArrayBuffer` to parse it, or omit to start an empty archive.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `archive?` | `ArrayBuffer` |

#### Returns

`ZipArchive`

## Properties

| Property | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| <a id="allowstreams"></a> `allowStreams` | `boolean` | `true` | Permit using the `CompressionStream` API for deflate compression/decompression when available. |
| <a id="allowzlib"></a> `allowZlib` | `boolean` | `true` | Permit using `node:zlib` for deflate compression/decompression when available. |
| <a id="checkcrc"></a> `checkCrc` | `boolean` | `false` | Verify CRC32 checksums when reading files. Will cause a throws on a mismatch. By default checksums are ignored. |

## Accessors

### files

#### Get Signature

```ts
get files(): string[];
```

Array of all entry names (files and directories) in the archive.

##### Returns

`string`[]

## Methods

### delete()

```ts
delete(path: string): boolean;
```

Removes an entry from the archive.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The filename or path of the entry to remove. |

#### Returns

`boolean`

`true` if the entry was found and removed, `false` if it did not exist.

***

### has()

```ts
has(path: string): boolean;
```

Returns `true` if any entry (file or directory) with that name exists.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The filename or path of the entry to read. |

#### Returns

`boolean`

***

### info()

```ts
info(path: string): ZipEntryInfo | undefined;
```

Returns metadata for a file, or `undefined` if it does not exist.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The filename or path of the entry to read. |

#### Returns

[`ZipEntryInfo`](#type-aliaseszipentryinfomd) \| `undefined`

An info entry for the given entitiy, or `undefined` if entitiy does not exist.

***

### read()

```ts
read(path: string): Promise<ArrayBuffer | undefined>;
```

Reads a file from the archive. Returns `undefined` if the file does not exist.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The filename or path of the entry to read. |

#### Returns

`Promise`\<`ArrayBuffer` \| `undefined`\>

The entry's data in an ArrayBuffer` or `undefined` if the entry does not exist.

#### Throws

if the file is encrypted or uses an unsupported compression method.

***

### readText()

```ts
readText(path: string): Promise<string | undefined>;
```

Reads a textfile from the archive. Returns `undefined` if the file does not exist.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The filename or path of the entry to read. |

#### Returns

`Promise`\<`string` \| `undefined`\>

The entry's data in an ArrayBuffer` or `undefined` if the entry does not exist.

#### Throws

if the file is encrypted or uses an unsupported compression method.

***

### toArrayBuffer()

```ts
toArrayBuffer(): ArrayBuffer;
```

Serialises the archive to an `ArrayBuffer`.

#### Returns

`ArrayBuffer`

***

### write()

```ts
write(
   path: string, 
   data: string | BufferSource, 
mode?: ZMode): Promise<void>;
```

Adds or replaces a file in the archive.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The filename or path of the entry to write. |
| `data` | `string` \| `BufferSource` | The data to add to the archive. Accepts a string, `ArrayBuffer`, `DataView`, or any typed array. |
| `mode?` | [`ZMode`](#type-aliaseszmodemd) | Compression mode. Defaults to `ZMODE_DEFLATE` (8), which applies deflate compression when it reduces the file size and falls back to store otherwise. Pass `ZMODE_STORE` (0) to store without compression. |

#### Returns

`Promise`\<`void`\>


<a name="type-aliaseszmodemd"></a>

# ZMode

```ts
type ZMode = 
  | typeof Z_STORE
  | typeof Z_DEFLATE;
```


<a name="type-aliaseszipentryinfomd"></a>

# ZipEntryInfo

```ts
type ZipEntryInfo = {
  comment: string;
  crc: number;
  isDir: boolean;
  mtime: Date;
  name: string;
  size: number;
};
```

Metadata returned by [ZipArchive.info](#info).

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="comment"></a> `comment` | `string` | Entry comment string, or an empty string if none. |
| <a id="crc"></a> `crc` | `number` | CRC-32 checksum of the uncompressed content. |
| <a id="isdir"></a> `isDir` | `boolean` | `true` if the entry is a directory. |
| <a id="mtime"></a> `mtime` | `Date` | Last-modified time. |
| <a id="name"></a> `name` | `string` | Entry name/path. |
| <a id="size"></a> `size` | `number` | Uncompressed size in bytes. |


<a name="variablesz_deflatemd"></a>

# Z\_DEFLATE

```ts
const Z_DEFLATE: "deflate" = 'deflate';
```


<a name="variablesz_storemd"></a>

# Z\_STORE

```ts
const Z_STORE: "store" = 'store';
```
