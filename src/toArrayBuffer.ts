export function toArrayBuffer (data: Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(data.length);
  new Uint8Array(arrayBuffer).set(data);
  return arrayBuffer;
}
