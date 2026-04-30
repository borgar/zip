const MIN_DATE = 0x00210000;
const MAX_DATE = 0xEF9FBF7D;

/**
 * Convert a 32-bit DOS timestamp to a JS Date.
 */
export function dosToDate (dos: number): Date {
  dos >>>= 0; // force unsigned 32-bit

  // The maximum valid date in a DOS timestamp is December 31, 2099
  // we allow up to 2107 here, just because.
  const yy = ((dos >>> 25) & 0x7f) + 1980;
  const mm = (dos >>> 21) & 0x0f;
  const dd = (dos >>> 16) & 0x1f;
  const hr = (dos >>> 11) & 0x1f;
  const mn = (dos >>> 5) & 0x3f;
  const sc = (dos & 0x1f) * 2;
  return new Date(Date.UTC(yy, mm - 1, dd, hr, mn, sc));
}

/**
 * Convert a JS Date to a 32-bit DOS timestamp.
 *
 * The input is interpreted as UTC. If the date is outside the legal bounds of a DOS date (1980-2099)
 * then it will be clamped to the valid range.
 */
export function dateToDos (date: Date): number {
  const year   = date.getUTCFullYear();
  const month  = date.getUTCMonth() + 1;
  const day    = date.getUTCDate();
  const hour   = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();

  // underflow case
  let dos = MIN_DATE;
  if (year > 2099) {
    // overflow case
    dos = MAX_DATE;
  }
  else if (year >= 1980) {
    // regular case
    dos =
      ((year - 1980) << 25) |
      (month << 21) |
      (day << 16) |
      (hour << 11) |
      (minute << 5) |
      (second >>> 1);
  }
  return dos >>> 0; // force unsigned 32-bit
}
