import type { Settings } from "./settings";

const luma = (d: Uint8ClampedArray, i: number) => (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;

/**
 * Auto levels, a gamma nudge that brings the face to a natural mid tone,
 * a small saturation lift and a light unsharp mask. `k` is strength, 0 to 1.
 */
export function enhance(ctx: CanvasRenderingContext2D, W: number, H: number, k: number, s: Settings) {
  if (k <= 0) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const n = W * H;

  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[luma(d, i)]++;
  const pct = (q: number) => {
    let acc = 0;
    const target = n * q;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  let lo = Math.min(pct(0.004), 60);
  let hi = Math.max(pct(0.996), 190);
  if (hi - lo < 32) {
    lo = 0;
    hi = 255;
  }
  const stretch = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));

  // Sample the face region to pick a gamma.
  const t = s.top / 100;
  const f = s.face / 100;
  let sum = 0;
  let cnt = 0;
  for (let y = Math.floor(H * (t + 0.25 * f)); y < H * Math.min(0.98, t + 0.85 * f); y += 2) {
    for (let x = Math.floor(W * 0.36); x < W * 0.64; x += 2) {
      sum += luma(d, (y * W + x) * 4);
      cnt++;
    }
  }
  const m = Math.min(0.95, Math.max(0.05, stretch(cnt ? sum / cnt : 128)));
  const gamma = Math.min(1.25, Math.max(0.75, Math.log(0.56) / Math.log(m)));

  const lut = new Float32Array(256);
  for (let v = 0; v < 256; v++) lut[v] = v + (255 * Math.pow(stretch(v), gamma) - v) * k;
  const sat = 1 + 0.15 * k;
  for (let i = 0; i < d.length; i += 4) {
    const r = lut[d[i]];
    const g = lut[d[i + 1]];
    const b = lut[d[i + 2]];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = L + (r - L) * sat;
    d[i + 1] = L + (g - L) * sat;
    d[i + 2] = L + (b - L) * sat;
  }

  // Unsharp mask over a 3×3 box blur.
  const amt = 0.8 * k;
  if (amt > 0.01 && W > 2 && H > 2) {
    const src = new Uint8ClampedArray(d);
    const row = W * 4;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * row + x * 4;
        for (let c = 0; c < 3; c++) {
          const j = i + c;
          const blur =
            (src[j - row - 4] + src[j - row] + src[j - row + 4] +
              src[j - 4] + src[j] + src[j + 4] +
              src[j + row - 4] + src[j + row] + src[j + row + 4]) / 9;
          d[j] = src[j] + (src[j] - blur) * amt;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
