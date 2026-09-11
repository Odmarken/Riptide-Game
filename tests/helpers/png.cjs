// Minimal decoder for the repository's non-interlaced, 8-bit RGBA PNG assets.
const fs = require('node:fs');
const zlib = require('node:zlib');

function readRgbaPng(filename) {
  const png = fs.readFileSync(filename);
  if (png.subarray(1, 4).toString() !== 'PNG' || png[24] !== 8 || png[25] !== 6 || png[28] !== 0) {
    throw new Error(`Expected a non-interlaced 8-bit RGBA PNG: ${filename}`);
  }
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      chunks.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4, pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error(`Unknown PNG filter ${filter}`);
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      const left = x >= 4 ? pixels[offset - 4] : 0;
      const up = y ? pixels[offset - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[offset - stride - 4] : 0;
      const p = left + up - upperLeft;
      const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
      const paeth = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      pixels[offset] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return {
    width, height, pixels,
    alpha(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return 0;
      return pixels[(Math.floor(y) * width + Math.floor(x)) * 4 + 3];
    },
  };
}

module.exports = { readRgbaPng };
