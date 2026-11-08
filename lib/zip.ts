/**
 * Minimal ZIP writer — store method (no compression), UTF-8 names.
 *
 * Runs in the browser so a generated project can be downloaded as one archive
 * without a bundler dependency or a server round-trip. Pure computation, no DOM.
 */

export type ZipEntry = { path: string; content: string };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS time/date pair used by the ZIP format. */
function dosTimestamp(date: Date): { time: number; date: number } {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { time, date: day };
}

/**
 * Builds a `.zip` containing every entry at the archive root.
 *
 * Typed as Uint8Array<ArrayBuffer> (not the wider ArrayBufferLike) so the result
 * is a valid BlobPart without a cast at every call site.
 */
export function buildZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const stamp = dosTimestamp(now);
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.content);
    const checksum = crc32(data);

    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header
    view.setUint16(4, 20, true); // version needed to extract
    view.setUint16(6, 0x0800, true); // UTF-8 file names
    view.setUint16(8, 0, true); // stored, not deflated
    view.setUint16(10, stamp.time, true);
    view.setUint16(12, stamp.date, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, data.length, true); // compressed size
    view.setUint32(22, data.length, true); // uncompressed size
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true); // no extra field
    header.set(name, 30);

    local.push(header, data);

    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true); // central directory header
    recordView.setUint16(4, 20, true); // version made by
    recordView.setUint16(6, 20, true); // version needed
    recordView.setUint16(8, 0x0800, true);
    recordView.setUint16(10, 0, true);
    recordView.setUint16(12, stamp.time, true);
    recordView.setUint16(14, stamp.date, true);
    recordView.setUint32(16, checksum, true);
    recordView.setUint32(20, data.length, true);
    recordView.setUint32(24, data.length, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint32(42, offset, true); // where the local header starts
    record.set(name, 46);
    central.push(record);

    offset += header.length + data.length;
  }

  const centralSize = central.reduce((total, record) => total + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); // end of central directory
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const chunk of [...local, ...central, end]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

/** Filesystem-safe archive name from a chat title. */
export function archiveName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "openmi-project"}.zip`;
}
