import type { Settings } from "./settings";

/** Where the head sits in a source image, as fractions of its width and height. */
export type HeadGeo = {
  cx: number;
  eye: number;
  /** Crown to chin, as a fraction of image height. */
  head: number;
  /** Eye-line tilt in radians. */
  angle: number;
  multi: boolean;
};

/** Manual nudges: pan as fractions of the output frame, zoom as a multiplier. */
export type Adjust = { dx: number; dy: number; zoom: number };

export const NO_ADJUST: Adjust = { dx: 0, dy: 0, zoom: 1 };

/** The eye line sits this far down the head, crown to chin. */
export const EYE_FRAC = 1.15 / 2.15;

export const fallbackHead = (): HeadGeo => ({ cx: 0.5, eye: 0.38, head: 0.5, angle: 0, multi: false });

export function drawCrop(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  geo: HeadGeo,
  adj: Adjust,
  s: Settings,
  W: number,
  H: number,
) {
  const f = (s.face / 100) * adj.zoom;
  const t = s.top / 100;
  const scale = (f * H) / (geo.head * sh); // output px per source px
  const ex = W / 2 + adj.dx * W;
  const ey = (t + f * EYE_FRAC) * H + adj.dy * H;
  ctx.save();
  ctx.fillStyle = s.fill;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(ex, ey);
  ctx.scale(scale, scale);
  if (s.straighten && geo.angle) ctx.rotate(-geo.angle);
  ctx.drawImage(src, -geo.cx * sw, -geo.eye * sh, sw, sh);
  ctx.restore();
}
