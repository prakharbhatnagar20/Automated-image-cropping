import type { Adjust, HeadGeo } from "./geometry";

export type Status =
  | "queued"
  | "reading"
  | "detecting"
  | "ok"
  | "multi"
  | "noface"
  | "manual"
  | "edited"
  | "error";

export type Photo = {
  id: number;
  file: File;
  name: string;
  status: Status;
  /** Status from face finding, restored when the viewer resets their nudges. */
  autoStatus?: Status;
  message?: string;
  geo: HeadGeo | null;
  adj: Adjust;
  /** Downscaled copy for previews and face finding. */
  preview: HTMLCanvasElement | null;
};

export const STATUS_LABEL: Record<Status, { label: string; tone: "" | "ok" | "warn" | "err" | "edit" }> = {
  queued: { label: "Waiting", tone: "" },
  reading: { label: "Reading…", tone: "" },
  detecting: { label: "Finding face…", tone: "" },
  ok: { label: "Face centred", tone: "ok" },
  multi: { label: "Several faces, used largest", tone: "warn" },
  noface: { label: "No face found, drag to place", tone: "warn" },
  manual: { label: "Place by dragging", tone: "warn" },
  edited: { label: "Adjusted", tone: "edit" },
  error: { label: "Can’t open", tone: "err" },
};

export const isPhotoFile = (f: File) =>
  f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(f.name);
