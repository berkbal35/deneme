// Decoder test for YMB1: node decode_ymb.mjs file.ymb
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
const comp = readFileSync(process.argv[2]);
const buf = zlib.inflateRawSync(comp);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
let o = 0;
const u8 = () => buf[o++], u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; }, u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; };
const vint = () => { let r = 0, s = 0, b; do { b = buf[o++]; r += (b & 0x7f) * 2 ** s; s += 7; } while (b & 0x80); return (r % 2 ? -(r + 1) / 2 : r / 2); };
const tileOrigin = (x, y, z = 14) => { const n = 2 ** z; return [x / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI]; };
if (String.fromCharCode(...buf.subarray(0, 4)) !== 'YMB1') throw new Error('bad magic');
o = 4; const ver = u8(); const nTiles = u32();
let nb = 0, np = 0, withH = 0, ms = 0, lng0 = 1e9, lng1 = -1e9, lat0 = 1e9, lat1 = -1e9, maxPts = 0;
for (let t = 0; t < nTiles; t++) {
  const tx = u16(), ty = u16(), n = u32();
  const [olng, olat] = tileOrigin(tx, ty);
  const ox = Math.round(olng * 1e7), oy = Math.round(olat * 1e7);
  for (let i = 0; i < n; i++) {
    let px = ox, py = oy;   // each building's first point is relative to the tile origin
    const hdm = u16(), lv = u8(), flags = u8(), nr = u8();
    if (hdm) withH++; if (flags & 1) ms++;
    for (let r = 0; r < nr; r++) {
      const k = u16(); maxPts = Math.max(maxPts, k);
      for (let p = 0; p < k; p++) { px += vint(); py += vint(); const lng = px / 1e7, lat = py / 1e7; lng0 = Math.min(lng0, lng); lng1 = Math.max(lng1, lng); lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat); np++; }
    }
    nb++;
  }
}
if (o !== buf.length) throw new Error(`trailing bytes: ${buf.length - o}`);
console.log({ ver, nTiles, buildings: nb, points: np, withHeight: withH, microsoft: ms, maxRingPts: maxPts, bounds: [lng0, lat0, lng1, lat1].map((v) => +v.toFixed(5)), inflated: buf.length, file: comp.length });
