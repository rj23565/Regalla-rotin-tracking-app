// ─── Media pipeline · camera snapshots & compressed frame vault ──────────────
// Every image entering residency is compressed down to a tight dataURL —
// the local pipeline matrix never stores raw multi-megabyte frames.

export interface PixelFingerprint {
  r: number;
  g: number;
  b: number;
  brightness: number; // 0-1
  warmth: number; // 0-1 — red+amber dominance
  variance: number; // tonal spread
}

const MAX_DIM = 640;
const JPEG_Q = 0.72;

function drawToCanvas(img: CanvasImageSource, w: number, h: number, maxDim = MAX_DIM): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0, cw, ch);
  return canvas;
}

/** Compress an uploaded File into a compact JPEG dataURL. */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
        resolve(canvas.toDataURL('image/jpeg', JPEG_Q));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** Snapshot the live camera feed element into a compact JPEG dataURL. */
export function snapshotVideo(video: HTMLVideoElement): string | null {
  if (!video.videoWidth) return null;
  const canvas = drawToCanvas(video, video.videoWidth, video.videoHeight);
  return canvas.toDataURL('image/jpeg', JPEG_Q);
}

/**
 * Pixel fingerprint — samples a coarse 24×24 grid and derives tone metrics.
 * Deterministic heuristic input for the Allergen Shield; no network, no CV API.
 */
export function pixelFingerprint(dataURL: string): Promise<PixelFingerprint | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight, 24);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let r = 0, g = 0, b = 0;
        const lumas: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          lumas.push((data[i] + data[i + 1] + data[i + 2]) / 3 / 255);
        }
        const n = data.length / 4;
        r /= n;
        g /= n;
        b /= n;
        const brightness = lumas.reduce((a, x) => a + x, 0) / n;
        const variance = lumas.reduce((a, x) => a + (x - brightness) ** 2, 0) / n;
        const warmth = Math.min(1, Math.max(0, r / (r + g + b + 1) - 0.3)) * 3;
        resolve({ r: Math.round(r), g: Math.round(g), b: Math.round(b), brightness, warmth, variance });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

/** Extract the first decodable frame of a video clip as a compact dataURL. */
export function videoFrameToDataURL(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 6000);
    video.onloadeddata = () => {
      video.currentTime = 0.1;
    };
    video.onseeked = () => {
      try {
        const shot = snapshotVideo(video);
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(shot);
      } catch {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

export function fingerprintNote(fp: PixelFingerprint): string {
  if (fp.brightness > 0.82 && fp.warmth < 0.35) return 'optical fingerprint: pale cream tones — dairy/cream likelihood';
  if (fp.warmth > 0.5) return 'optical fingerprint: warm amber tones — roast/fry likelihood';
  if (fp.brightness < 0.35 && fp.variance < 0.02) return 'optical fingerprint: dark low-contrast frame — sauce/liquid likelihood';
  return 'optical fingerprint: mixed tonal matrix — no dominant hazard signature';
}
