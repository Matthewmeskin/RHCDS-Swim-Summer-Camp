// Generates a branded PLACEHOLDER logo at public/logo.png.
// Replace public/logo.png with the real Country Day Camp badge when available.
// Pure Node (zlib) PNG encoder — no external deps.
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const SIZE = 320;
const cx = SIZE / 2;
const cy = SIZE / 2;

// Brand palette
const cream = [253, 250, 245];
const green = [58, 125, 68];
const orange = [232, 107, 58];
const yellow = [242, 184, 75];
const aqua = [126, 200, 200];
const white = [255, 255, 255];

function lerp(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function px(x, y) {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const R = SIZE / 2 - 4;

  // Outside the badge -> transparent
  if (r > R) return [0, 0, 0, 0];
  // Green ring
  if (r > R - 18) return [...green, 255];

  // Inside the badge
  const top = y < cy - 6; // sky portion vs water portion
  // Water (aqua) lower third with a simple wave line
  const waveY = cy + 34 + Math.sin((x / SIZE) * Math.PI * 4) * 10;
  if (y > waveY) {
    return [...lerp(aqua, [90, 170, 175], (y - waveY) / 120), 255];
  }

  // Sky gradient (cream -> soft yellow toward the sun)
  let color = lerp(cream, yellow, Math.max(0, 1 - r / R));

  // Sun (orange disc) up and slightly left
  const sx = cx - 38;
  const sy = cy - 46;
  const sr = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
  if (sr < 30) color = orange;
  else if (sr < 36) color = lerp(orange, color, (sr - 30) / 6);

  // Tree trunk + canopy on the right
  const tx = cx + 44;
  const trunkTop = cy - 10;
  const trunkBot = waveY - 2;
  if (Math.abs(x - tx) < 6 && y > trunkTop && y < trunkBot) {
    color = [120, 80, 50];
  }
  const canopy = Math.sqrt((x - tx) ** 2 + (y - (cy - 28)) ** 2);
  if (canopy < 30) color = green;
  else if (canopy < 35) color = lerp(green, color, (canopy - 30) / 5);

  return [...color, 255];
}

// Build raw RGBA scanlines with PNG filter byte (0) per row.
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = px(x, y);
    raw[p++] = r;
    raw[p++] = g;
    raw[p++] = b;
    raw[p++] = a;
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c;
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const idat = zlib.deflateSync(raw);

const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync("public", { recursive: true });
writeFileSync("public/logo.png", png);
console.log(`Wrote public/logo.png (${png.length} bytes)`);
