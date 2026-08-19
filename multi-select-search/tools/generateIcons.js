// Generates the toolbar icons. No dependencies: draws into an RGBA buffer at
// 4x and box-downsamples for antialiasing, then encodes PNG with node:zlib.
//
//   node tools/generateIcons.js
//
// Two variants:
//   icon-*.png         muted  — default state (page not known to be supported)
//   icon-active-*.png  vivid  — set by declarativeContent on supported sites
//
// The mark is three "chip" rows: two ticked (solid checkbox + solid bar) and
// one unticked (outlined) — a multi-select list, legible down to 16px.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling factor

const VARIANTS = {
  'icon': { bg: [0x56, 0x52, 0x73], mark: [0xff, 0xff, 0xff], markAlpha: 0.82 },
  'icon-active': { bg: [0x6d, 0x5a, 0xe6], mark: [0xff, 0xff, 0xff], markAlpha: 1 }
};

// ── drawing ──────────────────────────────────────────────────────────

function makeCanvas(n) {
  return { n, px: new Float64Array(n * n * 4) }; // straight RGBA, 0..255 / 0..1
}

function blend(c, i, rgb, a) {
  if (a <= 0) return;
  const dst = c.px;
  const inv = 1 - a;
  dst[i] = dst[i] * inv + rgb[0] * a;
  dst[i + 1] = dst[i + 1] * inv + rgb[1] * a;
  dst[i + 2] = dst[i + 2] * inv + rgb[2] * a;
  dst[i + 3] = dst[i + 3] * inv + a;
}

// Rounded-rect coverage test in unit coordinates (0..1).
function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function fillRoundRect(c, x0, y0, x1, y1, r, rgb, alpha) {
  const n = c.n;
  for (let py = 0; py < n; py++) {
    const y = (py + 0.5) / n;
    if (y < y0 - r || y > y1 + r) continue;
    for (let px = 0; px < n; px++) {
      const x = (px + 0.5) / n;
      if (insideRoundRect(x, y, x0, y0, x1, y1, r)) {
        blend(c, (py * n + px) * 4, rgb, alpha);
      }
    }
  }
}

function strokeRoundRect(c, x0, y0, x1, y1, r, w, rgb, alpha) {
  const n = c.n;
  for (let py = 0; py < n; py++) {
    const y = (py + 0.5) / n;
    for (let px = 0; px < n; px++) {
      const x = (px + 0.5) / n;
      const outer = insideRoundRect(x, y, x0, y0, x1, y1, r);
      if (!outer) continue;
      const inner = insideRoundRect(x, y, x0 + w, y0 + w, x1 - w, y1 - w, Math.max(0, r - w));
      if (!inner) blend(c, (py * n + px) * 4, rgb, alpha);
    }
  }
}

function drawIcon(variant) {
  const v = VARIANTS[variant];
  const n = 128 * SS;
  const c = makeCanvas(n);

  // Background plate
  fillRoundRect(c, 0, 0, 1, 1, 0.22, v.bg, 1);

  const rows = [
    { y: 0.28, ticked: true },
    { y: 0.50, ticked: true },
    { y: 0.72, ticked: false }
  ];
  const boxSide = 0.17;
  const barH = 0.135;

  for (const row of rows) {
    const a = v.markAlpha * (row.ticked ? 1 : 0.55);
    const by0 = row.y - boxSide / 2;
    const by1 = row.y + boxSide / 2;
    if (row.ticked) {
      fillRoundRect(c, 0.15, by0, 0.15 + boxSide, by1, 0.045, v.mark, a);
    } else {
      strokeRoundRect(c, 0.15, by0, 0.15 + boxSide, by1, 0.045, 0.032, v.mark, a);
    }
    fillRoundRect(c, 0.40, row.y - barH / 2, 0.86, row.y + barH / 2, barH / 2, v.mark, a);
  }

  return c;
}

// Box-downsample the master canvas to `size`.
function downsample(master, size) {
  const step = master.n / size;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = Math.floor(y * step); sy < Math.floor((y + 1) * step); sy++) {
        for (let sx = Math.floor(x * step); sx < Math.floor((x + 1) * step); sx++) {
          const i = (sy * master.n + sx) * 4;
          r += master.px[i]; g += master.px[i + 1]; b += master.px[i + 2]; a += master.px[i + 3];
          count++;
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round((a / count) * 255);
    }
  }
  return out;
}

// ── PNG encoding ─────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // 10-12: compression / filter / interlace = 0

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── main ─────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const variant of Object.keys(VARIANTS)) {
  const master = drawIcon(variant);
  for (const size of SIZES) {
    const file = path.join(outDir, `${variant}-${size}.png`);
    fs.writeFileSync(file, encodePNG(downsample(master, size), size));
    console.log('wrote', path.relative(path.join(__dirname, '..'), file));
  }
}
