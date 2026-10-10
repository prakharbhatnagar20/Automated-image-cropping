"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import EmptyState from "./EmptyState";
import PhotoCard from "./PhotoCard";
import SettingsPanel from "./SettingsPanel";
import { findHead, loadFaceFinder } from "@/lib/faceFinder";
import { fallbackHead, NO_ADJUST, type Adjust, type HeadGeo } from "@/lib/geometry";
import { makePreview, renderFull, saveBlob, uniqueNames, type OutputFile } from "@/lib/images";
import { isPhotoFile, type Photo, type Status } from "@/lib/photo";
import { outPx, useSettings } from "@/lib/settings";

type Engine = "loading" | "ready" | "off";
const ENGINE_TEXT: Record<Engine, string> = {
  loading: "Loading face finder…",
  ready: "Face finder ready",
  off: "Face finder unavailable. Place faces by dragging.",
};

const fmt = (v: number) => String(+v.toFixed(2));

export default function Studio() {
  const settings = useSettings();
  const previewSettings = useDeferredValue(settings);
  const { W, H } = outPx(settings);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [engine, setEngine] = useState<Engine>("loading");
  const [toast, setToast] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);

  const nextId = useRef(1);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(new Set<number>());
  const photosRef = useRef(photos);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    let mounted = true;
    loadFaceFinder().then((f) => mounted && setEngine(f ? "ready" : "off"));
    return () => {
      mounted = false;
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const patch = useCallback((id: number, p: Partial<Photo>) => {
    setPhotos((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }, []);

  const prepare = useCallback(
    async (id: number, file: File) => {
      if (!alive.current.has(id)) return;
      patch(id, { status: "reading" });
      let preview: HTMLCanvasElement;
      try {
        preview = await makePreview(file);
      } catch {
        const heic = /\.(heic|heif)$/i.test(file.name);
        patch(id, {
          status: "error",
          message: heic
            ? "This browser can’t open HEIC photos. Export them as JPG first, or use Safari."
            : "This file couldn’t be opened. Use JPG, PNG or WebP.",
        });
        return;
      }
      if (!alive.current.has(id)) return;
      patch(id, { preview, geo: fallbackHead(), status: "detecting" });

      const faceapi = await loadFaceFinder();
      let found: HeadGeo | null = null;
      if (faceapi) {
        try {
          found = await findHead(faceapi, preview);
        } catch (e) {
          console.warn("[id-photo] detection failed", e);
        }
      }
      if (!alive.current.has(id)) return;
      const auto: Status = found ? (found.multi ? "multi" : "ok") : faceapi ? "noface" : "manual";
      setPhotos((ps) =>
        ps.map((p) =>
          p.id !== id
            ? p
            : { ...p, geo: found ?? p.geo, autoStatus: auto, status: p.status === "edited" ? "edited" : auto },
        ),
      );
    },
    [patch],
  );

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const files = [...list].filter(isPhotoFile);
      if (!files.length) {
        showToast("Those files aren’t photos. Add JPG, PNG or WebP images.");
        return;
      }
      const added: Photo[] = files.map((file) => ({
        id: nextId.current++,
        file,
        name: file.name,
        status: "queued",
        geo: null,
        adj: NO_ADJUST,
        preview: null,
      }));
      setPhotos((ps) => [...ps, ...added]);
      for (const p of added) {
        alive.current.add(p.id);
        // One photo at a time keeps memory flat for big batches.
        queue.current = queue.current.then(() => prepare(p.id, p.file)).catch(() => {});
      }
    },
    [prepare, showToast],
  );

  // Accept photos dropped anywhere on the page.
  useEffect(() => {
    const over = (e: globalThis.DragEvent) => e.preventDefault();
    const drop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    document.addEventListener("dragover", over);
    document.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("dragover", over);
      document.removeEventListener("drop", drop);
    };
  }, [addFiles]);

  const onAdjust = useCallback(
    (id: number, adj: Adjust) => {
      setPhotos((ps) =>
        ps.map((p) => (p.id === id && p.preview ? { ...p, adj, status: "edited" } : p)),
      );
    },
    [],
  );

  const onReset = useCallback((id: number) => {
    setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, adj: NO_ADJUST, status: p.autoStatus ?? p.status } : p)));
  }, []);

  const onRemove = useCallback((id: number) => {
    alive.current.delete(id);
    setPhotos((ps) => {
      const gone = ps.find((p) => p.id === id);
      if (gone?.preview) gone.preview.width = gone.preview.height = 0;
      return ps.filter((p) => p.id !== id);
    });
  }, []);

  const onSave = useCallback(
    async (id: number, kind: "jpg" | "png") => {
      const p = photosRef.current.find((x) => x.id === id);
      if (!p?.geo) return;
      try {
        const [file] = await renderFull(p.file, p.geo, p.adj, settings, { rect: kind === "jpg", circle: kind === "png" });
        if (file) saveBlob(file.blob, file.name);
      } catch (e) {
        console.warn(e);
        showToast("Could not prepare this photo.");
      }
    },
    [settings, showToast],
  );

  const saveAll = async () => {
    if (saving) return;
    const ready = photos.filter((p) => p.preview && p.geo && p.status !== "detecting");
    if (!ready.length) return showToast("No photos are ready yet.");
    if (!settings.rect && !settings.circle) return showToast("Turn on Rectangle or Circle under Output first.");
    setSaving(true);
    try {
      const entries: OutputFile[] = [];
      for (let i = 0; i < ready.length; i++) {
        setProgress(`Preparing ${i + 1} of ${ready.length}…`);
        const p = ready[i];
        try {
          entries.push(...(await renderFull(p.file, p.geo!, p.adj, settings)));
        } catch (e) {
          console.warn("[id-photo] render failed", p.name, e);
        }
      }
      setProgress("Packing ZIP…");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const names = uniqueNames(entries.map((e) => e.name));
      entries.forEach((e, i) => zip.file(names[i], e.blob));
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      saveBlob(blob, `id-photos_${W}x${H}.zip`);
    } catch (e) {
      console.warn(e);
      showToast("Could not build the ZIP.");
    } finally {
      setProgress("");
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!clearArmed) return;
    const t = setTimeout(() => setClearArmed(false), 3000);
    return () => clearTimeout(t);
  }, [clearArmed]);

  const clearAll = () => {
    if (!clearArmed) return setClearArmed(true);
    setClearArmed(false);
    alive.current.clear();
    photos.forEach((p) => p.preview && (p.preview.width = p.preview.height = 0));
    setPhotos([]);
  };

  const onDropZone = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M2 8V2h6M18 2h6v6M24 18v6h-6M8 24H2v-6" />
            <circle cx="13" cy="11" r="4" />
            <path d="M6 21c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
          </svg>
          <h1>ID Photo Studio</h1>
        </div>
        <div className="spec">
          <b>
            {fmt(settings.w)} × {fmt(settings.h)} {settings.unit}
          </b>{" "}
          · {settings.dpi} dpi · {W} × {H} px
        </div>
        <div className="engine" data-state={engine}>
          <i />
          <span>{ENGINE_TEXT[engine]}</span>
        </div>
      </header>

      <main className="layout">
        <SettingsPanel settings={settings} />

        <section className="work">
          <label
            className={dragOver ? "drop over" : "drop"}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDropZone}
          >
            <input
              id="file"
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="txt">
              <span className="big">Drop photos here, or choose files</span>
              <span className="small">JPG, PNG or WebP. Processed in your browser, so the photos are never uploaded.</span>
            </span>
            <span className="btn primary" aria-hidden="true">
              Choose photos
            </span>
          </label>

          {photos.length > 0 && (
            <div className="toolbar">
              <span className="count">{photos.length === 1 ? "1 photo" : `${photos.length} photos`}</span>
              <span className="progress">{progress}</span>
              <span className="spacer" />
              <button className="btn danger" type="button" onClick={clearAll}>
                {clearArmed ? "Click again to clear" : "Clear all"}
              </button>
              <button className="btn primary" type="button" onClick={saveAll} disabled={saving}>
                Save all as ZIP
              </button>
            </div>
          )}

          {photos.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid" style={{ "--ar": `${W} / ${H}` } as CSSProperties}>
              {photos.map((p) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  settings={previewSettings}
                  onAdjust={onAdjust}
                  onReset={onReset}
                  onRemove={onRemove}
                  onSave={onSave}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
