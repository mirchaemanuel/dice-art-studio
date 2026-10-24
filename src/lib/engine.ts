export interface Settings {
  columns: number;
  rows: number;
  dieSize: number;
  gap: number;
  brightness: number;
  contrast: number;
  normalize: boolean;
  dither: boolean;
  fit: "cover" | "contain";
}

export interface Mosaic {
  faces: Uint8Array;
  counts: number[];
  settings: Settings;
  sourceUrl: string;
  sourceName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  columns: 64,
  rows: 80,
  dieSize: 10,
  gap: 0,
  brightness: 0,
  contrast: 15,
  normalize: true,
  dither: true,
  fit: "cover",
};

export function validateSettings(settings: Settings): void {
  for (const dimension of [settings.columns, settings.rows]) {
    if (!Number.isInteger(dimension) || dimension < 1 || dimension > 240) {
      throw new Error("Scegli da 1 a 240 dadi per lato, usando numeri interi.");
    }
  }
  if (
    !Number.isFinite(settings.dieSize) ||
    settings.dieSize < 5 ||
    settings.dieSize > 50
  ) {
    throw new Error("Il lato del dado deve essere tra 5 e 50 mm.");
  }
  if (!Number.isFinite(settings.gap) || settings.gap < 0 || settings.gap > 5) {
    throw new Error("La distanza tra i dadi deve essere tra 0 e 5 mm.");
  }
  if (
    !Number.isFinite(settings.brightness) ||
    settings.brightness < -80 ||
    settings.brightness > 80 ||
    !Number.isFinite(settings.contrast) ||
    settings.contrast < -50 ||
    settings.contrast > 100
  ) {
    throw new Error("I valori di luminosità o contrasto non sono validi.");
  }
}

export function physicalSize(
  count: number,
  dieSize: number,
  gap: number,
): number {
  return (count * dieSize + Math.max(0, count - 1) * gap) / 10;
}

/** Six relative tones: more white pips make a black die appear brighter.
 * The source range is mapped to the limited tonal range of real dice.
 * This is a deterministic approximation, not a model or an AI operation.
 */
export function quantize(
  rgba: Uint8ClampedArray,
  settings: Settings,
): Pick<Mosaic, "faces" | "counts"> {
  validateSettings(settings);
  const { columns, rows, brightness, contrast, normalize, dither } = settings;
  const total = columns * rows;
  if (rgba.length !== total * 4)
    throw new Error("Dimensioni immagine non valide.");
  const tones = new Float32Array(total);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < total; i++) {
    const offset = i * 4;
    const alpha = rgba[offset + 3] / 255;
    const tone =
      (0.2126 * rgba[offset] +
        0.7152 * rgba[offset + 1] +
        0.0722 * rgba[offset + 2]) *
      alpha;
    tones[i] = tone;
    histogram[Math.round(tone)]++;
  }
  let low = 0;
  let high = 255;
  if (normalize) {
    let sum = 0;
    const percentile = Math.floor(total * 0.02);
    for (let i = 0; i < 256; i++) {
      sum += histogram[i];
      if (sum > percentile) {
        low = i;
        break;
      }
    }
    sum = 0;
    for (let i = 255; i >= 0; i--) {
      sum += histogram[i];
      if (sum > percentile) {
        high = i;
        break;
      }
    }
    // Uniform or nearly uniform images must retain their original tone.
    if (high - low < 8) {
      low = 0;
      high = 255;
    }
  }
  const gain = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < total; i++) {
    const normalized = ((tones[i] - low) * 255) / (high - low);
    tones[i] = Math.max(
      0,
      Math.min(255, gain * (normalized - 127.5) + 127.5 + brightness),
    );
  }
  const faces = new Uint8Array(total);
  const counts = [0, 0, 0, 0, 0, 0];
  const diffuse = (x: number, y: number, error: number, weight: number) => {
    if (x >= 0 && x < columns && y >= 0 && y < rows)
      tones[y * columns + x] += (error * weight) / 16;
  };
  // Serpentine Floyd–Steinberg reduces directional artifacts.
  for (let y = 0; y < rows; y++) {
    const direction = y % 2 === 0 ? 1 : -1;
    for (let step = 0; step < columns; step++) {
      const x = direction === 1 ? step : columns - 1 - step;
      const i = y * columns + x;
      const value = Math.max(0, Math.min(255, tones[i]));
      const level = Math.round(value / 51);
      faces[i] = level + 1;
      counts[level]++;
      if (dither) {
        const error = value - level * 51;
        diffuse(x + direction, y, error, 7);
        diffuse(x - direction, y + 1, error, 3);
        diffuse(x, y + 1, error, 5);
        diffuse(x + direction, y + 1, error, 1);
      }
    }
  }
  return { faces, counts };
}

export interface Block {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getBlocks(columns: number, rows: number, size = 10): Block[] {
  if (!Number.isInteger(size) || size < 1)
    throw new Error("Dimensione blocco non valida.");
  const blocks: Block[] = [];
  for (let y = 0; y < rows; y += size) {
    for (let x = 0; x < columns; x += size) {
      blocks.push({
        index: blocks.length,
        x,
        y,
        width: Math.min(size, columns - x),
        height: Math.min(size, rows - y),
      });
    }
  }
  return blocks;
}

export const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.27, 0.27],
    [0.5, 0.5],
    [0.73, 0.73],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.27, 0.25],
    [0.73, 0.25],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.75],
    [0.73, 0.75],
  ],
};
