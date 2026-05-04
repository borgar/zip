import type { Buffer } from 'node:buffer';
import { toArrayBuffer } from './toArrayBuffer.ts';

export type DeflateFunc = (data: ArrayBuffer) => ArrayBuffer | Promise<ArrayBuffer>;

// detect zlib (Node, etc.)
let zlib: null | { deflateRaw: any, inflateRaw: any } = null;
try {
  // some bundler/loaders may still return a module with no zlib
  const _zlib = await import('node:zlib');
  if (typeof _zlib?.deflateRaw === 'function' && typeof _zlib?.inflateRaw === 'function') {
    zlib = _zlib;
  }
}
catch (err) {
  // zlip is not available
}

// detect deflate (Browsers)
let haveStreams = false;
if (typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined') {
  haveStreams = true;
}

function getStream (deflate: boolean): DeflateFunc {
  return async function deflateBrowser (data: ArrayBuffer) {
    const stream = deflate
      ? new CompressionStream('deflate-raw')
      : new DecompressionStream('deflate-raw');
    const input = new Response(data).body!;
    const outputStream = input.pipeThrough(stream);
    const resp = new Response(outputStream);
    return resp.arrayBuffer();
  };
}

function getZlib (deflate: boolean): DeflateFunc {
  if (zlib) {
    return function deflateNode (data: ArrayBuffer): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const cb = (error: NodeJS.ErrnoException | null, result: Buffer) => {
          if (error) { return reject(error); }
          resolve(toArrayBuffer(result));
        };
        if (deflate) {
          zlib.deflateRaw(new Uint8Array(data), cb);
        }
        else {
          zlib.inflateRaw(new Uint8Array(data), cb);
        }
      });
    };
  }
  throw new Error('zlib is missing');
}

export function getDeflate (allowStreams = false, allowZlib = false): DeflateFunc {
  // prefer DecompressionStream if we have it
  if (allowStreams && haveStreams) {
    return getStream(true);
  }
  // in node/deno/bun we can have access directly to zlib
  if (allowZlib && zlib) {
    return getZlib(true);
  }
  // default to using a pure JS zlib implementation
  return async function deflateJS (data: ArrayBuffer): Promise<ArrayBuffer> {
    const uzip = await import('uzip');
    return toArrayBuffer(uzip.deflateRaw(new Uint8Array(data)));
  };
}

export function getInflate (allowStreams = false, allowZlib = false): DeflateFunc {
  // prefer DecompressionStream if we have it
  if (allowStreams && haveStreams) {
    return getStream(false);
  }
  // in node/deno/bun we can have access directly to zlib
  if (allowZlib && zlib) {
    return getZlib(false);
  }
  // default to using a pure JS zlib implementation
  return async function inflatePako (data: ArrayBuffer): Promise<ArrayBuffer> {
    const uzip = await import('uzip');
    return toArrayBuffer(uzip.inflateRaw(new Uint8Array(data)));
  };
}
