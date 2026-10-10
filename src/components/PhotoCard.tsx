"use client";

import { memo, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { enhance } from "@/lib/enhance";
import { drawCrop, type Adjust } from "@/lib/geometry";
import { STATUS_LABEL, type Photo } from "@/lib/photo";
import { circleBox, outPx, type Settings } from "@/lib/settings";

type Props = {
  photo: Photo;
  settings: Settings;
  onAdjust: (id: number, adj: Adjust) => void;
  onReset: (id: number) => void;
  onRemove: (id: number) => void;
  onSave: (id: number, kind: "jpg" | "png") => void;
};

const PREVIEW_CSS_WIDTH = 260;
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function PhotoCard({ photo, settings, onAdjust, onReset, onRemove, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const { W, H } = outPx(settings);
  const { preview, geo, adj } = photo;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !preview || !geo) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(PREVIEW_CSS_WIDTH * dpr);
    const ch = Math.round((cw * H) / W);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    drawCrop(ctx, preview, preview.width, preview.height, geo, adj, settings, cw, ch);
    if (settings.enhance) enhance(ctx, cw, ch, settings.strength / 100, settings);
  }, [preview, geo, adj, settings, W, H]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!preview) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: adj.dx, dy: adj.dy };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const el = e.currentTarget;
    onAdjust(photo.id, {
      ...adj,
      dx: d.dx + (e.clientX - d.x) / el.clientWidth,
      dy: d.dy + (e.clientY - d.y) / el.clientHeight,
    });
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = ARROWS[e.key];
    if (!dir || !preview) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.05 : 0.01;
    onAdjust(photo.id, { ...adj, dx: adj.dx + dir[0] * step, dy: adj.dy + dir[1] * step });
  };

  const status = STATUS_LABEL[photo.status];
  const vh = (100 * H) / W;
  const t = settings.top / 100;
  const f = settings.face / 100;
  const cb = circleBox(settings, W, H);

  return (
    <article className="card">
      <div
        className="frame"
        tabIndex={0}
        aria-label={`Proof of ${photo.name}. Drag or use arrow keys to move.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} />
        {preview && (
          <svg viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" x2="100" y1={t * vh} y2={t * vh} className="guide-line" />
            <line x1="0" x2="100" y1={(t + f) * vh} y2={(t + f) * vh} className="guide-line" />
            {settings.circle && (
              <circle cx="50" cy={cb.cyFrac * vh} r={(cb.D / W) * 50} className="guide-circle" />
            )}
          </svg>
        )}
        {!preview && <div className="busy">{photo.status === "error" ? "" : "Reading…"}</div>}
      </div>

      <div className="meta">
        <span className="fname" title={photo.name}>
          {photo.name}
        </span>
        <span className="chip" data-tone={status.tone}>
          {status.label}
        </span>
      </div>
      {photo.message && <p className="err">{photo.message}</p>}

      <div className="ctrl">
        <label htmlFor={`zoom-${photo.id}`}>Zoom</label>
        <input
          id={`zoom-${photo.id}`}
          type="range"
          min={70}
          max={150}
          step={1}
          value={Math.round(adj.zoom * 100)}
          disabled={!preview}
          onChange={(e) => onAdjust(photo.id, { ...adj, zoom: Number(e.target.value) / 100 })}
        />
        <button type="button" onClick={() => onReset(photo.id)} disabled={!preview}>
          Reset
        </button>
      </div>

      <div className="saves">
        {settings.rect && (
          <button type="button" onClick={() => onSave(photo.id, "jpg")} disabled={!preview}>
            Save JPG
          </button>
        )}
        {settings.circle && (
          <button type="button" onClick={() => onSave(photo.id, "png")} disabled={!preview}>
            Save circle
          </button>
        )}
        <button type="button" className="rm" onClick={() => onRemove(photo.id)}>
          Remove
        </button>
      </div>
    </article>
  );
}

export default memo(PhotoCard);
