import { drawCrop, type Adjust, type HeadGeo } from "./geometry";
import { enhance } from "./enhance";
import { jpegWithDpi, pngWithDpi } from "./printDpi";
import { circleBox, outPx, type Settings } from "./settings";

export type Decoded = { src: CanvasImageSource; w: number; h: number; close: () => void };

/** Decodes a photo with its EXIF orientation applied. */
export async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bm = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: bm, w: bm.width, h: bm.height, close: () => bm.close() };
    } catch {}
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/** A copy no larger than `maxSide`, used for previews and face finding. */
export async function makePreview(file: Blob, maxSide = 1024) {
  const full = await decode(file);
  try {
    const k = Math.min(1, maxSide / Math.max(full.w, full.h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(full.w * k));
    c.height = Math.max(1, Math.round(full.h * k));
    c.getContext("2d")!.drawImage(full.src, 0, 0, c.width, c.height);
    return c;
  } finally {
    full.close();
  }
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), type, quality),
  );

export type Shapes = { rect: boolean; circle: boolean };
export type OutputFile = { name: string; blob: Blob };

/** Renders the print-size files for one photo from its original, full-resolution file. */
export async function renderFull(
  file: File,
  geo: HeadGeo,
  adj: Adjust,
  s: Settings,
  shapes: Shapes = { rect: s.rect, circle: s.circle },
): Promise<OutputFile[]> {
  const { W, H } = outPx(s);
  const full = await decode(file);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  try {
    drawCrop(ctx, full.src, full.w, full.h, geo, adj, s, W, H);
  } finally {
    full.close();
  }
  if (s.enhance) enhance(ctx, W, H, s.strength / 100, s);

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  const out: OutputFile[] = [];
  if (shapes.rect) {
    out.push({ name: `${base}_id.jpg`, blob: await jpegWithDpi(await toBlob(c, "image/jpeg", 0.95), s.dpi) });
  }
  if (shapes.circle) {
    const cb = circleBox(s, W, H);
    const cc = document.createElement("canvas");
    cc.width = cb.D;
    cc.height = cb.D;
    const cx = cc.getContext("2d")!;
    cx.drawImage(c, cb.x, cb.y, cb.D, cb.D, 0, 0, cb.D, cb.D);
    // Masking with destination-in keeps the circle edge anti-aliased.
    cx.globalCompositeOperation = "destination-in";
    cx.beginPath();
    cx.arc(cb.D / 2, cb.D / 2, cb.D / 2, 0, Math.PI * 2);
    cx.fill();
    out.push({ name: `${base}_id_circle.png`, blob: await pngWithDpi(await toBlob(cc, "image/png"), s.dpi) });
    cc.width = cc.height = 0;
  }
  c.width = c.height = 0;
  return out;
}

/** Gives each repeated filename a numeric suffix: a.jpg, a_2.jpg, a_3.jpg. */
export function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = (seen.get(n) ?? 0) + 1;
    seen.set(n, count);
    return count > 1 ? n.replace(/(\.[^.]+)$/, `_${count}$1`) : n;
  });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
