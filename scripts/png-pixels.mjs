// Decodes the PNGs the screenshot script writes (8-bit, non-interlaced) to RGBA pixels, so a
// screenshot is only rewritten when what it shows changes, not when its bytes do.
import { inflateSync } from "node:zlib";

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }; // grey, RGB, grey + alpha, RGBA

export function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let ihdr;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") ihdr = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("PNG without IHDR");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const [depth, colorType, , , interlace] = ihdr.subarray(8, 13);
  const ch = CHANNELS[colorType];
  if (depth !== 8 || !ch || interlace) throw new Error(`unsupported PNG (depth ${depth}, type ${colorType}, interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[row + x - ch] : 0;
      const b = y ? px[row - stride + x] : 0;
      const c = x >= ch && y ? px[row - stride + x - ch] : 0;
      let p;
      if (filter === 0) p = 0;
      else if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else if (filter === 4) {
        const e = a + b - c;
        const da = Math.abs(e - a);
        const db = Math.abs(e - b);
        const dc = Math.abs(e - c);
        p = da <= db && da <= dc ? a : db <= dc ? b : c;
      } else throw new Error(`bad PNG filter ${filter}`);
      px[row + x] = (src[x] + p) & 0xff;
    }
  }
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = px.subarray(i * ch, i * ch + ch);
    const grey = ch <= 2;
    data[i * 4] = s[0];
    data[i * 4 + 1] = grey ? s[0] : s[1];
    data[i * 4 + 2] = grey ? s[0] : s[2];
    data[i * 4 + 3] = ch === 2 ? s[1] : ch === 4 ? s[3] : 255;
  }
  return { width, height, data };
}

// True when both PNGs show exactly the same pixels; anything unreadable counts as different.
export function samePixels(a, b) {
  try {
    const x = decodePng(a);
    const y = decodePng(b);
    return x.width === y.width && x.height === y.height && x.data.equals(y.data);
  } catch {
    return false;
  }
}
