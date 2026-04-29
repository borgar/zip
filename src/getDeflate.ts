import { deflateRaw as deflateJS } from 'pako';
import type { Buffer } from 'node:buffer';
import { toArrayBuffer } from './toArrayBuffer.ts';

export type InflateFunc = (data: ArrayBuffer) => ArrayBuffer | Promise<ArrayBuffer>;

// detect zlib (Node, etc.)
let zlib: null | { deflateRaw: any } = null;
try {
  // some bundler/loaders may still return a module with no zlib
  const _zlib = await import('node:zlib');
  if (typeof _zlib?.deflateRaw === 'function') { zlib = _zlib; }
}
catch (err) {
  // zlip is not available
}

// detect deflate (Browsers)
let haveStreams = false;
if (typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined') {
  haveStreams = true;
}

export function getDeflate (allowStreams = false, allowZlib = false): InflateFunc {
  // prefer DecompressionStream if we have it
  if (allowStreams && haveStreams) {
    return async function deflateBrowser (data: ArrayBuffer) {
      const cs = new CompressionStream('deflate-raw');
      const input = new Response(data).body!;
      const outputStream = input.pipeThrough(cs);
      const resp = new Response(outputStream);
      return resp.arrayBuffer();
    };
  }
  // in node/deno/bun we can have access directly to zlib
  if (allowZlib && zlib) {
    return function deflateNode (data: ArrayBuffer): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        zlib.deflateRaw(new Uint8Array(data), (error: NodeJS.ErrnoException | null, result: Buffer) => {
          if (error) { return reject(error); }
          resolve(toArrayBuffer(result));
        });
      });
    };
  }
  // default to using pako, which is a pure JS zlib implementation
  return function deflatePako (data: ArrayBuffer): ArrayBuffer {
    return toArrayBuffer(deflateJS(new Uint8Array(data)));
  };
}
