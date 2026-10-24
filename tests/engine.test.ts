import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  getBlocks,
  physicalSize,
  quantize,
} from "../src/lib/engine";
import type { Settings } from "../src/lib/engine";

function pixels(tones: number[], alpha = 255): Uint8ClampedArray {
  return new Uint8ClampedArray(
    tones.flatMap((tone) => [tone, tone, tone, alpha]),
  );
}
const plain: Settings = {
  ...DEFAULT_SETTINGS,
  columns: 6,
  rows: 1,
  brightness: 0,
  contrast: 0,
  normalize: false,
  dither: false,
};

describe("Conversione deterministica in sei facce", () => {
  it("mappa toni crescenti alle facce da 1 a 6 nell’ordine corretto", () => {
    const result = quantize(pixels([0, 51, 102, 153, 204, 255]), plain);
    expect(Array.from(result.faces)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.counts).toEqual([1, 1, 1, 1, 1, 1]);
  });
  it("conserva il tono di immagini uniformi quando normalizza", () => {
    for (const tone of [0, 102, 255]) {
      const result = quantize(pixels(Array(6).fill(tone)), {
        ...plain,
        normalize: true,
      });
      expect(new Set(result.faces)).toEqual(
        new Set([Math.round(tone / 51) + 1]),
      );
    }
  });
  it("compone la trasparenza sul nero", () => {
    expect(
      Array.from(quantize(pixels(Array(6).fill(255), 0), plain).faces),
    ).toEqual(Array(6).fill(1));
  });
  it("il dithering preserva la media dei toni e produce solo facce valide", () => {
    const settings = { ...plain, columns: 100, rows: 100, dither: true };
    const input = pixels(Array(10_000).fill(127));
    const first = quantize(input, settings);
    const second = quantize(input, settings);
    expect(first.faces).toEqual(second.faces);
    expect(first.faces.length).toBe(10_000);
    expect(first.counts.reduce((sum, count) => sum + count, 0)).toBe(10_000);
    expect(Math.min(...first.faces)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...first.faces)).toBeLessThanOrEqual(6);
    const mean =
      first.faces.reduce((sum, face) => sum + (face - 1) * 51, 0) /
      first.faces.length;
    expect(Math.abs(mean - 127)).toBeLessThan(1);
  });
  it("gestisce 1 × 1, matrici estreme e il limite massimo", () => {
    for (const [columns, rows] of [
      [1, 1],
      [1, 240],
      [240, 1],
      [240, 240],
    ]) {
      const result = quantize(pixels(Array(columns * rows).fill(153)), {
        ...plain,
        columns,
        rows,
        dither: true,
      });
      expect(result.faces.length).toBe(columns * rows);
      expect(result.counts.reduce((sum, count) => sum + count, 0)).toBe(
        columns * rows,
      );
    }
  });
  it("rifiuta dimensioni non intere, fuori limite e buffer errati", () => {
    for (const columns of [0, -1, 241, 2.5, NaN])
      expect(() => quantize(pixels([0]), { ...plain, columns })).toThrow();
    expect(() => quantize(pixels([0]), plain)).toThrow();
    expect(() =>
      quantize(pixels([0, 0, 0, 0, 0, 0]), { ...plain, gap: -1 }),
    ).toThrow();
  });
});

describe("Schema di costruzione", () => {
  it("copre esattamente ogni dado una volta, inclusi i blocchi incompleti", () => {
    const columns = 23;
    const rows = 17;
    const blocks = getBlocks(columns, rows);
    expect(blocks).toHaveLength(6);
    expect(blocks[5]).toEqual({ index: 5, x: 20, y: 10, width: 3, height: 7 });
    const cells = new Uint8Array(columns * rows);
    for (const block of blocks)
      for (let y = block.y; y < block.y + block.height; y++)
        for (let x = block.x; x < block.x + block.width; x++)
          cells[y * columns + x]++;
    expect(Array.from(cells).every((count) => count === 1)).toBe(true);
  });
  it("calcola la dimensione fisica con spazi solo tra i dadi", () => {
    expect(physicalSize(10, 16, 1)).toBe(16.9);
    expect(physicalSize(1, 16, 5)).toBe(1.6);
  });
});
