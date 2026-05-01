import { inflateRaw as inflateJS } from 'uzip';
import type { Buffer } from 'node:buffer';
import { toArrayBuffer } from './toArrayBuffer.ts';

export type InflateFunc = (data: ArrayBuffer) => ArrayBuffer | Promise<ArrayBuffer>;

// detect zlib (Node, etc.)
let zlib: null | { inflateRaw: any } = null;
try {
  // some bundler/loaders may still return a module with no zlib
  const _zlib = await import('node:zlib');
  if (typeof _zlib?.inflateRaw === 'function') { zlib = _zlib; }
}
catch (err) {
  // zlip is not available
}

// detect deflate (Browsers)
let haveStreams = false;
if (typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined') {
  haveStreams = true;
}

export function getInflate (allowStreams = false, allowZlib = false): InflateFunc {
  // prefer DecompressionStream if we have it
  if (allowStreams && haveStreams) {
    return async function inflateBrowser (data: ArrayBuffer) {
      const ds = new DecompressionStream('deflate-raw');
      const input = new Response(data).body!;
      const outputStream = input.pipeThrough(ds);
      const resp = new Response(outputStream);
      return resp.arrayBuffer();
    };
  }
  // in node/deno/bun we can have access directly to zlib
  if (allowZlib && zlib) {
    return function inflateNode (data: ArrayBuffer): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        zlib.inflateRaw(new Uint8Array(data), (error: NodeJS.ErrnoException | null, result: Buffer) => {
          if (error) { return reject(error); }
          resolve(toArrayBuffer(result));
        });
      });
    };
  }
  // default to using pako, which is a pure JS zlib implementation
  return function inflatePako (data: ArrayBuffer): ArrayBuffer {
    return toArrayBuffer(inflateJS(new Uint8Array(data)));
  };
}
