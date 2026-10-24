import { PIPS } from "./engine";
import type { Mosaic } from "./engine";

function drawDie(
  ctx: CanvasRenderingContext2D,
  face: number,
  x: number,
  y: number,
  cell: number,
  dieSize: number,
  gap: number,
): void {
  const inset = Math.max(cell * 0.025, (cell * gap) / (dieSize + gap) / 2);
  const size = cell - inset * 2;
  ctx.fillStyle = "#191b1a";
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, size, size, cell * 0.09);
  ctx.fill();
  ctx.strokeStyle = "#30322f";
  ctx.lineWidth = Math.max(0.4, cell * 0.025);
  ctx.stroke();
  ctx.fillStyle = "#f4f1e8";
  for (const [px, py] of PIPS[face]) {
    ctx.beginPath();
    ctx.arc(
      x + inset + px * size,
      y + inset + py * size,
      size * 0.112,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function createTiles(mosaic: Mosaic, cell: number): HTMLCanvasElement[] {
  return [1, 2, 3, 4, 5, 6].map((face) => {
    const tile = document.createElement("canvas");
    tile.width = tile.height = cell;
    drawDie(
      tile.getContext("2d")!,
      face,
      0,
      0,
      cell,
      mosaic.settings.dieSize,
      mosaic.settings.gap,
    );
    return tile;
  });
}

/** Render reusable die tiles once rather than thousands of individual paths. */
export function drawMosaic(
  canvas: HTMLCanvasElement,
  mosaic: Mosaic,
  cell = 20,
  grid = false,
): void {
  const { columns, rows } = mosaic.settings;
  canvas.width = columns * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");
  ctx.fillStyle = "#101211";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tiles = createTiles(mosaic, cell);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++)
      ctx.drawImage(
        tiles[mosaic.faces[y * columns + x] - 1],
        x * cell,
        y * cell,
      );
  }
  if (grid) {
    ctx.strokeStyle = "#e9b773b0";
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.beginPath();
    for (let x = 10; x < columns; x += 10) {
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, canvas.height);
    }
    for (let y = 10; y < rows; y += 10) {
      ctx.moveTo(0, y * cell);
      ctx.lineTo(canvas.width, y * cell);
    }
    ctx.stroke();
  }
}

export interface ViewportRender {
  width: number;
  height: number;
  cell: number;
  offsetX: number;
  offsetY: number;
  pixelRatio: number;
  grid: boolean;
}

const previewTiles = new WeakMap<
  Mosaic,
  { cell: number; tiles: HTMLCanvasElement[] }
>();

/** Render directly at screen resolution. Canvas size stays bounded to the
 * viewport even at 800% zoom; only visible dice are drawn, never a scaled layer.
 */
export function drawMosaicViewport(
  canvas: HTMLCanvasElement,
  mosaic: Mosaic,
  view: ViewportRender,
): void {
  const { width, height, cell, offsetX, offsetY, pixelRatio, grid } = view;
  const { columns, rows, dieSize, gap } = mosaic.settings;
  const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const startX = Math.max(0, Math.floor(-offsetX / cell));
  const endX = Math.min(columns, Math.ceil((width - offsetX) / cell));
  const startY = Math.max(0, Math.floor(-offsetY / cell));
  const endY = Math.min(rows, Math.ceil((height - offsetY) / cell));
  if (startX >= endX || startY >= endY) return;

  ctx.fillStyle = "#101211";
  ctx.fillRect(offsetX, offsetY, columns * cell, rows * cell);
  const tileSize = Math.ceil(cell * pixelRatio);
  // Small tiles are cached at current device resolution. For a few very large
  // dice, draw vector paths directly instead of allocating oversized tiles.
  let tiles: HTMLCanvasElement[] | undefined;
  if (tileSize <= 128) {
    let cached = previewTiles.get(mosaic);
    if (cached?.cell !== tileSize) {
      cached = { cell: tileSize, tiles: createTiles(mosaic, tileSize) };
      previewTiles.set(mosaic, cached);
    }
    tiles = cached.tiles;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const face = mosaic.faces[y * columns + x];
      const dx = offsetX + x * cell;
      const dy = offsetY + y * cell;
      if (tiles) ctx.drawImage(tiles[face - 1], dx, dy, cell, cell);
      else drawDie(ctx, face, dx, dy, cell, dieSize, gap);
    }
  }
  if (grid) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, columns * cell, rows * cell);
    ctx.clip();
    ctx.strokeStyle = "#e9b773b0";
    ctx.lineWidth = Math.max(1 / pixelRatio, cell * 0.05);
    ctx.beginPath();
    for (
      let x = Math.max(10, Math.ceil(startX / 10) * 10);
      x < Math.min(columns, endX + 1);
      x += 10
    ) {
      ctx.moveTo(offsetX + x * cell, offsetY + startY * cell);
      ctx.lineTo(offsetX + x * cell, offsetY + endY * cell);
    }
    for (
      let y = Math.max(10, Math.ceil(startY / 10) * 10);
      y < Math.min(rows, endY + 1);
      y += 10
    ) {
      ctx.moveTo(offsetX + startX * cell, offsetY + y * cell);
      ctx.lineTo(offsetX + endX * cell, offsetY + y * cell);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportPng(mosaic: Mosaic): Promise<void> {
  const canvas = document.createElement("canvas");
  // At most 3840 px per side, to keep mobile canvas memory bounded.
  const cell = Math.max(
    4,
    Math.min(
      32,
      Math.floor(
        3840 / Math.max(mosaic.settings.columns, mosaic.settings.rows),
      ),
    ),
  );
  drawMosaic(canvas, mosaic, cell);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Esportazione PNG non riuscita.")),
      "image/png",
    );
  });
  saveBlob(blob, `dado-${mosaic.settings.columns}x${mosaic.settings.rows}.png`);
}

export function exportCsv(mosaic: Mosaic): void {
  const { columns, rows } = mosaic.settings;
  // First row and column identify 1-based coordinates, with no mirrored axes.
  const lines = [
    "riga/colonna;" +
      Array.from({ length: columns }, (_, i) => i + 1).join(";"),
  ];
  for (let y = 0; y < rows; y++)
    lines.push(
      `${y + 1};${Array.from(mosaic.faces.slice(y * columns, (y + 1) * columns)).join(";")}`,
    );
  saveBlob(
    new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    `dado-${columns}x${rows}-matrice.csv`,
  );
}
