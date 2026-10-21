import type { Buffer } from 'node:buffer';
import { toArrayBuffer } from './toArrayBuffer.ts';

export type DeflateFunc = (data: ArrayBuffer) => ArrayBuffer | Promise<ArrayBuffer>;

type Zlib = { deflateRaw: any, inflateRaw: any };

function isZlib (mod: any): mod is Zlib {
  return typeof mod?.deflateRaw === 'function' && typeof mod?.inflateRaw === 'function';
}

// detect zlib lazily, and only where it may exist
let zlibPromise: Promise<Zlib | null> | null = null;
function loadZlib (): Promise<Zlib | null> {
  if (!zlibPromise) {
    zlibPromise = (async () => {
      const proc = globalThis.process;
      if (!proc?.versions?.node) {
        return null;
      }
      try {
        // Node 20.16+, 22.3+, Deno, and Bun: bundlers don't analyze this call
        if (typeof proc.getBuiltinModule === 'function') {
          const mod = proc.getBuiltinModule('node:zlib');
          if (isZlib(mod)) {
            return mod;
          }
        }
        // older Node
        const mod = await import(/* webpackIgnore: true *//* @vite-ignore */'node:zlib');
        return isZlib(mod) ? mod : null;
      }
      catch (err) {
        // zlib is not available
        return null;
      }
    })();
  }
  return zlibPromise;
}

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

function runZlib (zlib: Zlib, deflate: boolean, data: ArrayBuffer): Promise<ArrayBuffer> {
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
}

function getFallback (deflate: boolean, allowZlib: boolean): DeflateFunc {
  return async function deflateFallback (data: ArrayBuffer): Promise<ArrayBuffer> {
    // in node/deno/bun we may have access to zlib
    const zlib = allowZlib ? await loadZlib() : null;
    if (zlib) {
      return runZlib(zlib, deflate, data);
    }
    // default to using a pure JS zlib implementation
    const uzip = await import('uzip');
    const input = new Uint8Array(data);
    return toArrayBuffer(deflate ? uzip.deflateRaw(input) : uzip.inflateRaw(input));
  };
}

export function getDeflate (allowStreams = false, allowZlib = false): DeflateFunc {
  if (allowStreams && haveStreams) {
    return getStream(true);
  }
  return getFallback(true, allowZlib);
}

export function getInflate (allowStreams = false, allowZlib = false): DeflateFunc {
  if (allowStreams && haveStreams) {
    return getStream(false);
  }
  return getFallback(false, allowZlib);
}
