const CP437 = '' +
  '\x00☺☻♥♦♣♠•◘○◙♂♀♪♫☼' +
  '►◄↕‼¶§▬↨↑↓→←∟↔▲▼' +
  ' !"#$%&\'()*+,-./' +
  '0123456789:;<=>?' +
  '@ABCDEFGHIJKLMNO' +
  'PQRSTUVWXYZ[\\]^_' +
  '`abcdefghijklmno' +
  'pqrstuvwxyz{|}~⌂' +
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
  'áíóúñÑªº¿⌐¬½¼¡«»' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αßΓπΣσµτΦΘΩδ∞φε∩' +
  '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xa0';

export function decodeCp437 (data: ArrayBuffer | Uint8Array | DataView) {
  let str = '';
  const b = data instanceof Uint8Array
    ? data
    : data instanceof DataView
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);

  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < b.length; i++) {
    // console.log(i, b[i], CP437[b[i]]);
    str += CP437[b[i]] ?? '';
  }
  return str;
}
