export function toArrayBuffer (data: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(data.length);
  new Uint8Array(arrayBuffer).set(data);
  return arrayBuffer;
}
