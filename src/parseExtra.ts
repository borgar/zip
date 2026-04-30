export type ExtraField = {
  headerId: number;
  data: Uint8Array;
};

export function parseExtra (data: ArrayBuffer): ExtraField[] {
  const view = new DataView(data);
  const out: ExtraField[] = [];
  let i = 0;

  while (i + 4 <= data.byteLength) {
    const headerId = view.getUint16(i, true);
    const size = view.getUint16(i + 2, true);
    i += 4;

    if (i + size > data.byteLength) {
      // if we hit a malformed field, we just give up and return what we have
      return out;
    }

    out.push({
      headerId,
      // data: new Uint8Array(data).subarray(i, i + size),
      data: new Uint8Array(data, i, size),
    });
    i += size;
  }

  return out;
}
