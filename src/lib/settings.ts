import { useSyncExternalStore } from "react";

export type Unit = "in" | "cm" | "mm";

export type Settings = {
  w: number;
  h: number;
  unit: Unit;
  dpi: number;
  /** Head height (crown to chin) as a percentage of the photo height. */
  face: number;
  /** Space above the crown as a percentage of the photo height. */
  top: number;
  straighten: boolean;
  rect: boolean;
  circle: boolean;
  enhance: boolean;
  strength: number;
  fill: string;
};

export const DEFAULTS: Settings = {
  w: 4.5,
  h: 5,
  unit: "in",
  dpi: 300,
  face: 65,
  top: 12,
  straighten: true,
  rect: true,
  circle: true,
  enhance: true,
  strength: 60,
  fill: "#ffffff",
};

export const DPI_OPTIONS = [200, 300, 350, 600];

export const PRESETS: { w: number; h: number; unit: Unit }[] = [
  { w: 4.5, h: 5, unit: "in" },
  { w: 3.5, h: 4.5, unit: "cm" },
  { w: 2, h: 2, unit: "in" },
  { w: 2.5, h: 3, unit: "cm" },
];

export const PER_INCH: Record<Unit, number> = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4 };
export const MAX_PX = 8000;

export function rawPx(s: Settings) {
  return {
    W: Math.round(s.w * PER_INCH[s.unit] * s.dpi),
    H: Math.round(s.h * PER_INCH[s.unit] * s.dpi),
  };
}

export function outPx(s: Settings) {
  const { W, H } = rawPx(s);
  const clamp = (v: number) => Math.min(MAX_PX, Math.max(16, v));
  return { W: clamp(W), H: clamp(H) };
}

/** The circle crop: as wide as the photo's short side, centred on the head where it fits. */
export function circleBox(s: Settings, W: number, H: number) {
  const D = Math.min(W, H);
  const want = (s.top / 100 + s.face / 200) * H;
  const cy = Math.min(H - D / 2, Math.max(D / 2, want));
  return { D, x: (W - D) / 2, y: cy - D / 2, cyFrac: cy / H };
}

/* ---------- persisted store ---------- */

const KEY = "idps-settings";
const listeners = new Set<() => void>();
let current: Settings | null = null;

function sanitize(raw: Partial<Settings>): Settings {
  const s = { ...DEFAULTS, ...raw };
  if (!(s.unit in PER_INCH)) s.unit = DEFAULTS.unit;
  if (!DPI_OPTIONS.includes(s.dpi)) s.dpi = DEFAULTS.dpi;
  if (!(s.w > 0) || !(s.h > 0)) Object.assign(s, { w: DEFAULTS.w, h: DEFAULTS.h });
  return s;
}

function read(): Settings {
  if (current) return current;
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {}
  current = sanitize(stored);
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}
