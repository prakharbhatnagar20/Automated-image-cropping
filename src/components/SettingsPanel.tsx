"use client";

import { useState } from "react";
import {
  DPI_OPTIONS,
  MAX_PX,
  PER_INCH,
  PRESETS,
  rawPx,
  updateSettings,
  type Settings,
  type Unit,
} from "@/lib/settings";

const fmt = (v: number) => String(+v.toFixed(2));

function sizeHint(s: Settings) {
  const { W, H } = rawPx(s);
  if (W > MAX_PX || H > MAX_PX) return { warn: true, text: `Capped at ${MAX_PX} px per side. Lower the dpi or size.` };
  if (Math.max(s.w, s.h) * PER_INCH[s.unit] >= 4) {
    return { warn: false, text: "Large for an ID card. Most card photos are about 3.5 × 4.5 cm." };
  }
  return null;
}

/** A number box that lets people type freely and only commits valid values. */
function SizeInput({ id, label, value, onCommit }: { id: string; label: string; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="number"
      min={0.1}
      max={100}
      step={0.1}
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = parseFloat(e.target.value);
        if (v >= 0.1 && v <= 100) onCommit(v);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export default function SettingsPanel({ settings: s }: { settings: Settings }) {
  const hint = sizeHint(s);
  return (
    <aside className="panel" aria-label="Settings">
      <section>
        <h2>Print size</h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={`${p.w}x${p.h}${p.unit}`}
              type="button"
              aria-pressed={p.w === s.w && p.h === s.h && p.unit === s.unit}
              onClick={() => updateSettings({ w: p.w, h: p.h, unit: p.unit })}
            >
              {fmt(p.w)} × {fmt(p.h)} {p.unit}
            </button>
          ))}
        </div>
        <div className="size-row">
          <SizeInput id="set-w" label="Width" value={s.w} onCommit={(w) => updateSettings({ w })} />
          <span>×</span>
          <SizeInput id="set-h" label="Height" value={s.h} onCommit={(h) => updateSettings({ h })} />
          <select
            id="set-unit"
            aria-label="Unit"
            value={s.unit}
            onChange={(e) => updateSettings({ unit: e.target.value as Unit })}
          >
            <option value="in">in</option>
            <option value="cm">cm</option>
            <option value="mm">mm</option>
          </select>
        </div>
        <label className="field" htmlFor="set-dpi">
          Resolution (dpi)
          <select id="set-dpi" value={s.dpi} onChange={(e) => updateSettings({ dpi: Number(e.target.value) })}>
            {DPI_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {hint && <p className={hint.warn ? "hint warn" : "hint"}>{hint.text}</p>}
      </section>

      <section>
        <h2>Framing</h2>
        <label className="field" htmlFor="set-face">
          <span className="field-row">
            Head height <output>{s.face}%</output>
          </span>
          <input id="set-face" type="range" min={45} max={85} step={1} value={s.face}
            onChange={(e) => updateSettings({ face: Number(e.target.value) })} />
        </label>
        <label className="field" htmlFor="set-top">
          <span className="field-row">
            Space above head <output>{s.top}%</output>
          </span>
          <input id="set-top" type="range" min={3} max={25} step={1} value={s.top}
            onChange={(e) => updateSettings({ top: Number(e.target.value) })} />
        </label>
        <label className="check">
          <input id="set-straighten" type="checkbox" checked={s.straighten}
            onChange={(e) => updateSettings({ straighten: e.target.checked })} />
          Level tilted heads
        </label>
        <p className="hint">Head height runs from the top of the head to the chin, measured against the photo height.</p>
      </section>

      <section>
        <h2>Output</h2>
        <label className="check">
          <input id="set-rect" type="checkbox" checked={s.rect} onChange={(e) => updateSettings({ rect: e.target.checked })} />
          Rectangle <small>JPG</small>
        </label>
        <label className="check">
          <input id="set-circle" type="checkbox" checked={s.circle} onChange={(e) => updateSettings({ circle: e.target.checked })} />
          Circle, clear corners <small>PNG</small>
        </label>
      </section>

      <section>
        <h2>Enhance</h2>
        <label className="check">
          <input id="set-enhance" type="checkbox" checked={s.enhance}
            onChange={(e) => updateSettings({ enhance: e.target.checked })} />
          Auto brightness, colour and sharpness
        </label>
        <label className="field" htmlFor="set-strength">
          <span className="field-row">
            Strength <output>{s.strength}%</output>
          </span>
          <input id="set-strength" type="range" min={10} max={100} step={5} value={s.strength} disabled={!s.enhance}
            onChange={(e) => updateSettings({ strength: Number(e.target.value) })} />
        </label>
      </section>

      <section>
        <h2>Edge fill</h2>
        <div className="fill-row">
          <input id="set-fill" type="color" aria-label="Edge fill colour" value={s.fill}
            onChange={(e) => updateSettings({ fill: e.target.value })} />
          <span>Fills any gap when the photo doesn’t reach the frame edge</span>
        </div>
      </section>
    </aside>
  );
}
