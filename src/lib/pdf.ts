import { jsPDF } from "jspdf";
import { getBlocks, physicalSize, PIPS } from "./engine";
import type { Mosaic } from "./engine";
import { drawMosaic, saveBlob } from "./render";

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(n);

export async function exportPdf(
  mosaic: Mosaic,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const { columns, rows, dieSize, gap } = mosaic.settings;
  const blocks = getBlocks(columns, rows);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.setProperties({
    title: `Dado - Guida ${columns} x ${rows}`,
    subject: "Schema di montaggio con dadi neri a sei facce",
    creator: "Dado - dice_picture",
  });
  const header = (title: string, subtitle: string) => {
    pdf.setTextColor(25, 28, 26);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text(title, 18, 24);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(subtitle, 18, 32);
    pdf.setDrawColor(215, 215, 210);
    pdf.line(18, 38, 192, 38);
  };
  const footer = (page: number) => {
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 105);
    pdf.text("DADO / Guida di montaggio / Vista frontale", 18, 286);
    pdf.text(`${page} / ${blocks.length + 1}`, 192, 286, { align: "right" });
  };
  const drawDie = (face: number, x: number, y: number, size: number) => {
    pdf.setFillColor(25, 28, 26);
    pdf.roundedRect(x, y, size, size, 0.8, 0.8, "F");
    pdf.setFillColor(255, 255, 255);
    for (const [px, py] of PIPS[face])
      pdf.circle(x + px * size, y + py * size, size * 0.1, "F");
  };
  header(
    "Dado. Il tuo quadro, un dado alla volta.",
    `${columns} colonne x ${rows} righe / ${fmt(columns * rows)} dadi`,
  );
  const canvas = document.createElement("canvas");
  const cell = Math.max(
    2,
    Math.min(16, Math.floor(1200 / Math.max(columns, rows))),
  );
  drawMosaic(canvas, mosaic, cell);
  const scale = Math.min(100 / canvas.width, 110 / canvas.height);
  const imageWidth = canvas.width * scale;
  const imageHeight = canvas.height * scale;
  pdf.addImage(
    canvas,
    "PNG",
    18,
    47,
    imageWidth,
    imageHeight,
    undefined,
    "FAST",
  );
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Prima di iniziare", 130, 52);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const materials = [
    `${fmt(columns * rows)} dadi neri`,
    "con punti bianchi, a 6 facce.",
    `Lato di ciascun dado: ${fmt(dieSize)} mm.`,
    `Spazio tra dadi: ${fmt(gap)} mm.`,
    "Dimensione del mosaico:",
    `${fmt(physicalSize(columns, dieSize, gap))} x ${fmt(physicalSize(rows, dieSize, gap))} cm.`,
    "(Cornice esclusa.)",
    "",
    "Prepara un supporto rigido",
    "e un adesivo adatto ai materiali.",
  ];
  pdf.text(materials, 130, 61, { lineHeightFactor: 1.6 });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Le sei facce", 18, 172);
  mosaic.counts.forEach((count, i) => {
    const x = 18 + i * 29;
    drawDie(i + 1, x, 179, 11);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(25, 28, 26);
    pdf.text(`${fmt(count)} dadi`, x, 196);
  });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Come leggere lo schema", 18, 213);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const instructions = [
    "1. Il quadro è visto frontalmente: non specchiare lo schema.",
    "2. Parti dall'angolo in alto a sinistra: riga 1, colonna 1.",
    "3. Segui i blocchi da sinistra a destra, poi passa alla fascia successiva.",
    "4. Ogni numero indica i punti bianchi sulla faccia rivolta verso di te.",
    "5. Orienta le facce come nella legenda, in particolare 2, 3 e 6.",
    "6. Controlla le coordinate prima di fissare i dadi al supporto.",
    "Il bianco e il nero della foto sono compressi nei sei toni disponibili dei dadi.",
  ];
  pdf.text(instructions, 18, 222, { lineHeightFactor: 1.6 });
  footer(1);
  for (const block of blocks) {
    pdf.addPage();
    header(
      `Blocco ${block.index + 1} di ${blocks.length}`,
      `Righe ${block.y + 1}-${block.y + block.height} / Colonne ${block.x + 1}-${block.x + block.width}`,
    );
    const cellSize = 15.6;
    const startX = 29;
    const startY = 60;
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 75);
    for (let x = 0; x < block.width; x++)
      pdf.text(
        String(block.x + x + 1),
        startX + (x + 0.5) * cellSize,
        startY - 5,
        { align: "center" },
      );
    for (let y = 0; y < block.height; y++) {
      pdf.setTextColor(80, 80, 75);
      pdf.setFontSize(9);
      pdf.text(
        String(block.y + y + 1),
        startX - 5,
        startY + (y + 0.5) * cellSize + 1.5,
        { align: "right" },
      );
      for (let x = 0; x < block.width; x++) {
        const face = mosaic.faces[(block.y + y) * columns + block.x + x];
        pdf.setDrawColor(205, 205, 200);
        pdf.setLineWidth(0.2);
        pdf.rect(
          startX + x * cellSize,
          startY + y * cellSize,
          cellSize,
          cellSize,
        );
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(17);
        pdf.setTextColor(25, 28, 26);
        pdf.text(
          String(face),
          startX + (x + 0.5) * cellSize,
          startY + (y + 0.5) * cellSize + 2,
          { align: "center" },
        );
      }
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(25, 28, 26);
    pdf.text("Orientamento delle facce (vista frontale)", 29, 237);
    for (let face = 1; face <= 6; face++) {
      drawDie(face, 29 + (face - 1) * 26, 243, 9);
      pdf.setTextColor(25, 28, 26);
      pdf.text(String(face), 41 + (face - 1) * 26, 249);
    }
    pdf.setDrawColor(120, 120, 115);
    pdf.rect(29, 263, 4, 4);
    pdf.text("Blocco completato e verificato", 37, 266.5);
    footer(block.index + 2);
    if (block.index % 8 === 0) {
      onProgress?.(Math.round(((block.index + 1) / blocks.length) * 100));
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }
  onProgress?.(100);
  saveBlob(pdf.output("blob"), `dado-${columns}x${rows}-guida.pdf`);
}
