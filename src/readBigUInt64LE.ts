// this isn't going to yield a 64bit number, but likely will be enough for many cases
export function readBigUInt64LE (data: DataView, index: number) {
  return (
    data.getUint8(index) +
    data.getUint8(index + 1) * 0x100 +
    data.getUint8(index + 2) * 0x10000 +
    data.getUint8(index + 3) * 0x1000000 +
    data.getUint8(index + 4) * 0x100000000 +
    data.getUint8(index + 5) * 0x10000000000 +
    data.getUint8(index + 6) * 0x1000000000000 +
    data.getUint8(index + 7) * 0x100000000000000
  );
}
