import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function roundedRectCoverage(x, y, size, inset, radius) {
  const min = inset;
  const max = size - inset;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.hypot(dx, dy);
  return clamp01(radius + 0.5 - distance);
}

function crossCoverage(x, y, size, arm, thickness) {
  const c = size / 2;
  const inBar = (halfW, halfH) => {
    const dx = Math.abs(x - c) - halfW;
    const dy = Math.abs(y - c) - halfH;
    return clamp01(0.5 - Math.max(dx, dy));
  };
  return Math.max(inBar(arm, thickness), inBar(thickness, arm));
}

function drawIcon(size, { bleed }) {
  const pixels = Buffer.alloc(size * size * 4);
  const inset = bleed ? 0 : size * 0.06;
  const radius = bleed ? 0 : size * 0.24;
  const scale = bleed ? 0.62 : 0.72;
  const arm = (size * scale) / 2;
  const thickness = size * scale * 0.17;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = clamp01((x / size) * 0.45 + (y / size) * 0.55);
      const bg = [
        Math.round(lerp(124, 67, t)),
        Math.round(lerp(58, 56, t)),
        Math.round(lerp(237, 202, t)),
      ];

      const plate = roundedRectCoverage(x + 0.5, y + 0.5, size, inset, radius);
      const cross = crossCoverage(x + 0.5, y + 0.5, size, arm, thickness) * plate;

      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(lerp(bg[0], 255, cross));
      pixels[offset + 1] = Math.round(lerp(bg[1], 255, cross));
      pixels[offset + 2] = Math.round(lerp(bg[2], 255, cross));
      pixels[offset + 3] = Math.round(plate * 255);
    }
  }

  return encodePng(size, pixels);
}

const targets = [
  ['icon-192.png', 192, { bleed: false }],
  ['icon-512.png', 512, { bleed: false }],
  ['icon-maskable-512.png', 512, { bleed: true }],
  ['apple-touch-icon.png', 180, { bleed: true }],
  ['badge-72.png', 72, { bleed: true }],
];

mkdirSync(OUT, { recursive: true });
for (const [name, size, options] of targets) {
  writeFileSync(join(OUT, name), drawIcon(size, options));
  console.log(`icons/${name}`);
}
