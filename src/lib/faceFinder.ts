import type { HeadGeo } from "./geometry";

type FaceApi = typeof import("@vladmandic/face-api");

let loading: Promise<FaceApi | null> | null = null;

/** Loads face-api and its models once. Resolves null when the browser can't run them. */
export function loadFaceFinder() {
  loading ??= (async () => {
    try {
      const faceapi = await import("@vladmandic/face-api");
      // face-api's typings cover only part of the bundled TensorFlow.js API.
      const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
      try {
        await tf.setBackend("webgl");
      } catch {}
      await tf.ready();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      ]);
      return faceapi;
    } catch (e) {
      console.warn("[id-photo] face finder unavailable", e);
      return null;
    }
  })();
  return loading;
}

type Point = { x: number; y: number };
const mean = (pts: Point[]) =>
  pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });

/** Finds the largest face and returns where its head sits, or null when there is no face. */
export async function findHead(faceapi: FaceApi, c: HTMLCanvasElement): Promise<HeadGeo | null> {
  const dets = await faceapi
    .detectAllFaces(c, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4, maxResults: 10 }))
    .withFaceLandmarks();
  if (!dets.length) return null;
  const best = dets.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a));
  const lm = best.landmarks;
  let e1 = mean(lm.getLeftEye());
  let e2 = mean(lm.getRightEye());
  if (e1.x > e2.x) [e1, e2] = [e2, e1];
  const eye = { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 };
  const chin = lm.getJawOutline()[8];
  const d = Math.hypot(chin.x - eye.x, chin.y - eye.y);
  let angle = Math.atan2(e2.y - e1.y, e2.x - e1.x);
  if (Math.abs(angle) > 0.35) angle = 0; // over ~20°, trust the photo over the landmarks
  return {
    cx: eye.x / c.width,
    eye: eye.y / c.height,
    // The eyes sit near the middle of the head, so crown to chin is about twice eye to chin.
    head: (2.15 * d) / c.height,
    angle,
    // Weak or tiny detections in the background shouldn't count as a second person.
    multi: dets.some(
      (d) => d !== best && d.detection.score >= 0.6 && d.detection.box.area >= best.detection.box.area * 0.25,
    ),
  };
}
