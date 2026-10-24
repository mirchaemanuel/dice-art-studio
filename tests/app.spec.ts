import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Genera il quadro" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("img", {
      name: "Mosaico di 64 per 80 dadi neri con punti bianchi",
    }),
  ).toBeVisible();
});

test("anteprima, zoom, confronto e blocchi di montaggio", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Aumenta zoom" }).click();
  await expect(page.locator(".zoom-value")).toHaveText("125%");
  await page.getByRole("button", { name: "Adatta anteprima" }).click();
  await expect(page.locator(".zoom-value")).toHaveText("100%");
  await page.getByRole("checkbox", { name: "Foto originale" }).check();
  await expect(
    page.getByRole("img", { name: "Fotografia originale", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Foto originale" }).uncheck();
  await page.getByRole("tab", { name: "Guida di montaggio" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Blocco successivo" }).click();
  await expect(
    page.getByRole("heading", { name: "Blocco 2 / 56" }),
  ).toBeVisible();
  await expect(page.locator(".block-header p")).toContainText("Colonne 11–20");
  await page.getByRole("button", { name: "Segna come completato" }).click();
  await expect(page.locator(".assembly-progress")).toContainText("1 / 56");
  await page.getByRole("button", { name: "Blocco 56", exact: true }).click();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(10);
  await expect(
    page.getByRole("table").locator("tbody tr").first().locator("td"),
  ).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("caricamento, matrice personalizzata e convalida input", async ({
  page,
}) => {
  await page.getByLabel("Numero di colonne").fill("23");
  await page.getByLabel("Numero di righe").fill("17");
  await page.getByLabel("Lato del dado in millimetri").fill("16");
  await page.getByLabel("Spazio tra dadi in millimetri").fill("1");
  await page.getByRole("button", { name: "Applica e genera" }).click();
  await expect(
    page.getByRole("img", {
      name: "Mosaico di 23 per 17 dadi neri con punti bianchi",
    }),
  ).toBeVisible();
  await expect(page.locator(".result-stats")).toContainText("39");
  await page
    .getByLabel("Carica una fotografia")
    .setInputFiles("public/sample.jpg");
  await expect(page.locator(".sample-line")).toContainText("sample.jpg");
  await expect(
    page.getByRole("button", { name: "Genera il quadro" }),
  ).toBeEnabled();
  await page.getByLabel("Carica una fotografia").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("JPG, PNG o WebP");
  await page.getByRole("button", { name: "Chiudi errore" }).click();
  await page.getByLabel("Numero di colonne").fill("999");
  await page.getByLabel("Numero di colonne").blur();
  await expect(page.getByLabel("Numero di colonne")).toHaveValue("240");
});

test("esporta PNG, CSV e PDF coerenti con una matrice 13 × 11", async ({
  page,
}, testInfo) => {
  await page.getByLabel("Numero di colonne").fill("13");
  await page.getByLabel("Numero di righe").fill("11");
  await page.getByRole("button", { name: "Applica e genera" }).click();
  await expect(
    page.getByRole("img", {
      name: "Mosaico di 13 per 11 dadi neri con punti bianchi",
    }),
  ).toBeVisible();
  const csvEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Matrice CSV", exact: true }).click();
  const csv = await csvEvent;
  const csvPath = testInfo.outputPath("matrix.csv");
  await csv.saveAs(csvPath);
  const lines = (await readFile(csvPath, "utf8"))
    .replace(/^\uFEFF/, "")
    .split("\r\n");
  expect(lines).toHaveLength(12);
  expect(lines[0].split(";")).toHaveLength(14);
  expect(
    lines.slice(1).every(
      (line, i) =>
        Number(line.split(";")[0]) === i + 1 &&
        line
          .split(";")
          .slice(1)
          .every((face) => /^[1-6]$/.test(face)),
    ),
  ).toBe(true);
  const pngEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Anteprima PNG", exact: true })
    .click();
  const png = await pngEvent;
  const pngPath = testInfo.outputPath("preview.png");
  await png.saveAs(pngPath);
  const pngData = await readFile(pngPath);
  expect(pngData.subarray(1, 4).toString()).toBe("PNG");
  expect(pngData.readUInt32BE(16)).toBe(416);
  expect(pngData.readUInt32BE(20)).toBe(352);
  await expect(
    page.getByRole("button", { name: "Scarica la guida" }),
  ).toBeEnabled();
  const pdfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica la guida" }).click();
  const pdf = await pdfEvent;
  const pdfPath = testInfo.outputPath("guide.pdf");
  await pdf.saveAs(pdfPath);
  expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
  await expect(
    page.getByRole("button", { name: "Scarica la guida" }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Guida di montaggio" }).click();
  const firstFaces = await page
    .getByRole("table")
    .locator("tbody tr")
    .first()
    .locator("td")
    .allTextContents();
  expect(firstFaces).toEqual(lines[1].split(";").slice(1, 11));
});

test("schermo mobile senza overflow e nessuna richiesta esterna", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:5173") &&
      !request.url().startsWith("blob:") &&
      !request.url().startsWith("data:")
    )
      external.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Genera il quadro" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Guida di montaggio" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(external).toEqual([]);
  await page.getByRole("button", { name: "Come funziona" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Mircha Emanuel D'Angelo" }),
  ).toHaveAttribute("href", "https://a80.it");
});

test("zoom 800% nitido su schermo Retina con matrice 200 × 200", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Genera il quadro" }),
    ).toBeEnabled();
    await page.getByLabel("Numero di colonne").fill("200");
    await page.getByLabel("Numero di righe").fill("200");
    await page.getByRole("button", { name: "Applica e genera" }).click();
    await expect(
      page.getByRole("img", {
        name: "Mosaico di 200 per 200 dadi neri con punti bianchi",
      }),
    ).toBeVisible();
    for (let i = 0; i < 10; i++)
      await page.getByRole("button", { name: "Aumenta zoom" }).click();
    await expect(page.locator(".zoom-value")).toHaveText("800%");
    const inspect = () =>
      page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        return {
          width: canvas.width,
          height: canvas.height,
          cssWidth: rect.width,
          cssHeight: rect.height,
          dpr: window.devicePixelRatio,
        };
      });
    const size = await inspect();
    expect(size.width).toBe(Math.round(size.cssWidth * size.dpr));
    expect(size.height).toBe(Math.round(size.cssHeight * size.dpr));
    // The bitmap remains viewport-sized instead of growing with the full mosaic.
    expect(size.width * size.height).toBeLessThan(8_000_000);
    const viewport = page.locator(".preview-viewport");
    const rect = (await viewport.boundingBox())!;
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    await page.mouse.move(center.x, center.y);
    await expect(page.locator(".cell-readout")).toContainText("Riga 101");
    await expect(page.locator(".cell-readout")).toContainText("Colonna 101");
    await page.mouse.down();
    await page.mouse.move(center.x + 45, center.y + 30, { steps: 5 });
    await page.mouse.up();
    await page.mouse.move(center.x, center.y);
    await expect(page.locator(".cell-readout")).toContainText("Riga 99");
    await expect(page.locator(".cell-readout")).toContainText("Colonna 98");
    await page
      .getByRole("button", { name: "Mostra griglia dei blocchi" })
      .click();
    await expect(
      page.getByRole("button", { name: "Mostra griglia dei blocchi" }),
    ).toHaveAttribute("aria-pressed", "true");
    await viewport.screenshot({
      path: testInfo.outputPath("zoom-800-retina.png"),
    });
    await page.getByRole("button", { name: "Adatta anteprima" }).click();
    await expect(page.locator(".zoom-value")).toHaveText("100%");
    expect(await inspect()).toEqual(size);
    await page.getByRole("checkbox", { name: "Foto originale" }).check();
    await expect(
      page.getByRole("img", { name: "Fotografia originale", exact: true }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: "Foto originale" }).uncheck();
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect
      .poll(async () => {
        const updated = await inspect();
        return (
          updated.width === Math.round(updated.cssWidth * updated.dpr) &&
          updated.height === Math.round(updated.cssHeight * updated.dpr)
        );
      })
      .toBe(true);
  } finally {
    await context.close();
  }
});
