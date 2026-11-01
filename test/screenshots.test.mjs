// The screenshot script only rewrites a PNG when its decoded pixels change: re-encoding the
// same image (another zlib level, another filter, other chunks) must not count as a change.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { decodePng, samePixels } from "../scripts/png-pixels.mjs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
// A small RGB(A) PNG; filter 1 (Sub) or 0 (None) on every row, zlib level as given, IDAT split in two
function encode(width, height, pixels, { alpha = false, filter = 0, level = 9 } = {}) {
  const bpp = alpha ? 4 : 3;
  const raw = Buffer.alloc(height * (1 + width * bpp));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * bpp);
    raw[row] = filter;
    for (let x = 0; x < width * bpp; x++) {
      const v = pixels[(y * width + Math.floor(x / bpp)) * 4 + (x % bpp)];
      const left = x >= bpp ? pixels[(y * width + Math.floor((x - bpp) / bpp)) * 4 + (x % bpp)] : 0;
      raw[row + 1 + x] = filter === 1 ? (v - left) & 0xff : v;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  const z = deflateSync(raw, { level });
  const half = Math.floor(z.length / 2);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("tEXt", Buffer.from(`Software\0level ${level}`, "latin1")),
    chunk("IDAT", z.subarray(0, half)),
    chunk("IDAT", z.subarray(half)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const W = 5;
const H = 3;
const pixels = Uint8Array.from({ length: W * H * 4 }, (_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256));

test("the same pixels encoded differently are not a change", () => {
  const a = encode(W, H, pixels, { level: 0, filter: 0 });
  const b = encode(W, H, pixels, { level: 9, filter: 1 });
  const c = encode(W, H, pixels, { alpha: true, level: 6 });
  assert.notDeepEqual(a, b);
  assert.ok(samePixels(a, b));
  assert.ok(samePixels(a, c), "opaque RGBA equals RGB");
  assert.deepEqual(decodePng(a).data, Buffer.from(pixels));
});

test("one changed pixel, or another size, is a change", () => {
  const other = Uint8Array.from(pixels);
  other[7 * 4 + 1] ^= 1;
  assert.equal(samePixels(encode(W, H, pixels), encode(W, H, other)), false);
  assert.equal(samePixels(encode(W, H, pixels), encode(W - 1, H, pixels.subarray(0, (W - 1) * H * 4))), false);
  assert.equal(samePixels(Buffer.from("not a png"), encode(W, H, pixels)), false);
});

test("the README screenshots decode (Paeth/Up/Average filters of Chromium's encoder)", () => {
  for (const f of ["card", "card-dark"]) {
    const png = readFileSync(new URL(`../screenshots/${f}.png`, import.meta.url));
    const img = decodePng(png);
    assert.equal(img.data.length, img.width * img.height * 4, f);
    assert.ok(samePixels(png, encode(img.width, img.height, img.data, { alpha: true, filter: 1 })), f);
  }
});

test("the screenshot script writes a file only when its pixels differ", () => {
  const src = readFileSync(new URL("../scripts/screenshots.mjs", import.meta.url), "utf8");
  assert.match(src, /import \{ samePixels \} from "\.\/png-pixels\.mjs"/);
  assert.match(src, /if \(existsSync\(path\) && samePixels\(readFileSync\(path\), png\)\) \{[\s\S]*?\} else \{\s*writeFileSync\(path, png\);/);
  // Playwright must not write the file itself
  assert.doesNotMatch(src, /page\.screenshot\(\{\s*path:/);
});
