import pica from "pica";
import { quantize, validateSettings } from "./engine";
import type { Mosaic, Settings } from "./engine";

export interface SourceImage {
  image: HTMLImageElement;
  url: string;
  name: string;
  sample: boolean;
}

const resizer = pica();
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function loadImage(
  url: string,
  name: string,
  sample = false,
): Promise<SourceImage> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error(
      "Impossibile leggere la foto. Prova un file JPG, PNG o WebP valido.",
    );
  }
  if (image.naturalWidth * image.naturalHeight > 60_000_000) {
    throw new Error(
      "La foto supera 60 megapixel. Ridimensionala prima di caricarla.",
    );
  }
  return { image, url, name, sample };
}

export async function convertImage(
  source: SourceImage,
  settings: Settings,
): Promise<Mosaic> {
  validateSettings(settings);
  const { image } = source;
  const aspect = settings.columns / settings.rows;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (settings.fit === "cover") {
    if (sw / sh > aspect) {
      const width = sh * aspect;
      sx = (sw - width) / 2;
      sw = width;
    } else {
      const height = sw / aspect;
      sy = (sh - height) / 2;
      sh = height;
    }
  }
  const sourceCanvas = document.createElement("canvas");
  // Bounded intermediate buffer also handles extreme matrix aspect ratios.
  const scale = Math.min(1, 2048 / sw, 2048 / sh);
  const boundsWidth = Math.max(settings.columns, Math.round(sw * scale));
  const boundsHeight = Math.max(settings.rows, Math.round(sh * scale));
  sourceCanvas.width = boundsWidth;
  sourceCanvas.height = boundsHeight;
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) throw new Error("Il browser non supporta Canvas 2D.");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, boundsWidth, boundsHeight);
  if (settings.fit === "cover") {
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, boundsWidth, boundsHeight);
  } else {
    // Fit the whole photo into a target-shaped intermediate canvas.
    const maxSide = Math.min(
      2048,
      Math.max(image.naturalWidth, image.naturalHeight),
    );
    const factor = Math.max(
      1,
      Math.floor(maxSide / Math.max(settings.columns, settings.rows)),
    );
    sourceCanvas.width = settings.columns * factor;
    sourceCanvas.height = settings.rows * factor;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    const fitScale = Math.min(
      sourceCanvas.width / sw,
      sourceCanvas.height / sh,
    );
    const w = sw * fitScale;
    const h = sh * fitScale;
    ctx.drawImage(
      image,
      (sourceCanvas.width - w) / 2,
      (sourceCanvas.height - h) / 2,
      w,
      h,
    );
  }
  const small = document.createElement("canvas");
  small.width = settings.columns;
  small.height = settings.rows;
  await resizer.resize(sourceCanvas, small);
  const smallCtx = small.getContext("2d", { willReadFrequently: true });
  if (!smallCtx) throw new Error("Il browser non supporta Canvas 2D.");
  const rgba = smallCtx.getImageData(0, 0, small.width, small.height).data;
  sourceCanvas.width = sourceCanvas.height = 1;
  const result =
    typeof Worker === "undefined"
      ? quantize(rgba, settings)
      : await new Promise<Pick<Mosaic, "faces" | "counts">>(
          (resolve, reject) => {
            const worker = new Worker(
              new URL("./processor.worker.ts", import.meta.url),
              { type: "module" },
            );
            worker.onmessage = (event) => {
              worker.terminate();
              if (event.data.error) reject(new Error(event.data.error));
              else resolve(event.data);
            };
            worker.onerror = () => {
              worker.terminate();
              reject(
                new Error(
                  "Elaborazione interrotta. Prova a generare nuovamente il quadro.",
                ),
              );
            };
            worker.postMessage({ rgba, settings }, [rgba.buffer]);
          },
        );
  return {
    ...result,
    settings: { ...settings },
    sourceUrl: source.url,
    sourceName: source.name,
  };
}
