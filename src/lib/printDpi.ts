// Stamp the print resolution into encoded files so they print at the chosen size.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Sets the JFIF density fields, which canvas encoders leave at 1:1 aspect with no units. */
export async function jpegWithDpi(blob: Blob, dpi: number) {
  const b = new Uint8Array(await blob.arrayBuffer());
  const isJfif = b[2] === 0xff && b[3] === 0xe0 && b[6] === 0x4a && b[7] === 0x46 && b[8] === 0x49 && b[9] === 0x46;
  if (isJfif) {
    b[13] = 1;
    b[14] = dpi >> 8;
    b[15] = dpi & 255;
    b[16] = dpi >> 8;
    b[17] = dpi & 255;
  }
  return new Blob([b], { type: "image/jpeg" });
}

/** Replaces any pHYs chunk with one carrying `dpi`, placed right after IHDR. */
export async function pngWithDpi(blob: Blob, dpi: number) {
  const b = new Uint8Array(await blob.arrayBuffer());
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));

  const bv = new DataView(b.buffer);
  const parts: Uint8Array[] = [b.subarray(0, 33), chunk]; // signature + IHDR
  let off = 33;
  while (off + 8 <= b.length) {
    const len = bv.getUint32(off);
    const type = String.fromCharCode(b[off + 4], b[off + 5], b[off + 6], b[off + 7]);
    const end = off + 12 + len;
    if (type !== "pHYs") parts.push(b.subarray(off, end));
    off = end;
  }
  return new Blob(parts as BlobPart[], { type: "image/png" });
}
