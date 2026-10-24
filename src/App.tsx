import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileDown,
  ImagePlus,
  Info,
  Layers3,
  LockKeyhole,
  MoveUpRight,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UnlockKeyhole,
  Upload,
  X,
} from "lucide-react";
import { Die } from "./components/Die";
import { Preview } from "./components/Preview";
import { Assembly } from "./components/Assembly";
import { NumberInput } from "./components/NumberInput";
import { DEFAULT_SETTINGS, getBlocks, physicalSize } from "./lib/engine";
import type { Mosaic, Settings } from "./lib/engine";
import {
  convertImage,
  IMAGE_TYPES,
  loadImage,
  MAX_FILE_SIZE,
} from "./lib/image";
import type { SourceImage } from "./lib/image";
import { exportCsv, exportPng } from "./lib/render";

const number = (value: number, decimals = 0) =>
  new Intl.NumberFormat("it-IT", { maximumFractionDigits: decimals }).format(
    value,
  );

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="help-dialog"
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Chiudi finestra"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        <span className="toggle-description">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={onChange}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [source, setSource] = useState<SourceImage | null>(null);
  const [mosaic, setMosaic] = useState<Mosaic | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [locked, setLocked] = useState(false);
  const [original, setOriginal] = useState(false);
  const [tab, setTab] = useState<"preview" | "assembly">("preview");
  const [help, setHelp] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);
  const [pdfProgress, setPdfProgress] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const working = busy || loading;
  const dirty = Boolean(
    mosaic &&
    (JSON.stringify(settings) !== JSON.stringify(mosaic.settings) ||
      source?.url !== mosaic.sourceUrl),
  );
  const selected = mosaic?.settings ?? settings;
  const total = settings.columns * settings.rows;
  const blockCount = getBlocks(selected.columns, selected.rows).length;

  async function generate(image: SourceImage, config: Settings) {
    const id = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await convertImage(image, config);
      if (id !== generation.current) return;
      setMosaic(result);
      setRevision((value) => value + 1);
      setOriginal(false);
      setTab("preview");
    } catch (problem) {
      if (id === generation.current)
        setError(
          problem instanceof Error
            ? problem.message
            : "Conversione non riuscita. Riprova.",
        );
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadImage("/sample.jpg", "Migrant Mother · Dorothea Lange", true)
      .then((image) => {
        if (active) {
          setSource(image);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "Esempio non disponibile. Carica una tua foto per iniziare.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (source) void generate(source, settingsRef.current);
  }, [source]);

  // Keep the previous image URL alive while it is still displayed by a result.
  const urls = useRef(new Set<string>());
  useEffect(() => {
    for (const url of urls.current) {
      if (url !== source?.url && url !== mosaic?.sourceUrl) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
  }, [source, mosaic]);
  useEffect(() => {
    const allocated = urls.current;
    return () => {
      for (const url of allocated) URL.revokeObjectURL(url);
      allocated.clear();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateDimension(key: "columns" | "rows", value: number) {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      if (locked && source) {
        const aspect = source.image.naturalWidth / source.image.naturalHeight;
        if (key === "columns")
          next.rows = Math.max(1, Math.min(240, Math.round(value / aspect)));
        else
          next.columns = Math.max(1, Math.min(240, Math.round(value * aspect)));
      }
      return next;
    });
  }

  async function upload(file?: File) {
    if (!file || working) return;
    setError("");
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Scegli una foto JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("La foto supera 25 MB. Carica un file più leggero.");
      return;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    try {
      const image = await loadImage(url, file.name);
      setSource(image);
    } catch (problem) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
      setError(
        problem instanceof Error
          ? problem.message
          : "Caricamento non riuscito.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sample() {
    if (working) return;
    setLoading(true);
    try {
      setSource(
        await loadImage("/sample.jpg", "Migrant Mother · Dorothea Lange", true),
      );
    } catch {
      setError("Impossibile aprire la foto di esempio.");
    } finally {
      setLoading(false);
    }
  }

  function drop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files[0]);
  }

  async function download(kind: "pdf" | "png" | "csv") {
    if (!mosaic || exporting) return;
    setError("");
    if (kind === "csv") {
      exportCsv(mosaic);
      setNotice(
        "Matrice CSV scaricata. Le coordinate partono dall’alto a sinistra.",
      );
      return;
    }
    setExporting(kind);
    setPdfProgress(0);
    try {
      if (kind === "pdf") {
        const { exportPdf } = await import("./lib/pdf");
        await exportPdf(mosaic, setPdfProgress);
      } else await exportPng(mosaic);
      setNotice(
        kind === "pdf"
          ? "Guida PDF scaricata. Buon montaggio!"
          : "Anteprima PNG scaricata.",
      );
    } catch {
      setError(
        "Esportazione non riuscita. Riprova con una matrice più piccola.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Dado, inizio pagina">
            <span className="brand-icon">
              <Die size={32} />
            </span>
            <span>
              dado<span className="brand-period">.</span>
            </span>
            <span className="brand-tagline">DICE ART STUDIO</span>
          </a>
          <div className="header-actions">
            <span className="local-badge">
              <ShieldCheck size={15} /> La tua foto resta tua
            </span>
            <button className="help-button" onClick={() => setHelp(true)}>
              Come funziona <CircleHelp size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="intro">
          <div>
            <span className="eyebrow">
              <span className="small-line" /> PICCOLI DADI, GRANDI IDEE
            </span>
            <h1>
              La tua foto.
              <br className="mobile-break" /> <span>Un dado alla volta.</span>
            </h1>
            <p>
              Trasforma un’immagine in un quadro da costruire con le tue mani.
            </p>
          </div>
          <div className="intro-mark" aria-hidden="true">
            <Die value={2} size={39} />
            <Die value={5} size={39} />
            <Die value={6} size={39} />
          </div>
        </section>

        <div className="studio-layout">
          <aside
            className="settings-panel"
            aria-label="Impostazioni del quadro"
          >
            <section className="settings-section photo-section">
              <h2>
                <span className="step-number">01</span> La fotografia{" "}
                <span className="section-aside">IL PUNTO DI PARTENZA</span>
              </h2>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="file-input"
                aria-label="Carica una fotografia"
                disabled={working}
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button
                className={`upload-zone ${dragging ? "dragging" : ""}`}
                disabled={working}
                onClick={() => input.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={drop}
              >
                {source ? (
                  <img
                    src={source.url}
                    alt="Miniatura della foto selezionata"
                  />
                ) : (
                  <div className="upload-placeholder">
                    <ImagePlus size={26} />
                  </div>
                )}
                <span className="upload-copy">
                  <strong>
                    {loading ? "Apertura della foto…" : "Carica la tua foto"}
                  </strong>
                  <span>Trascina qui o scegli un file</span>
                  <small>JPG, PNG, WebP · max 25 MB</small>
                </span>
                <Upload size={17} className="upload-arrow" />
              </button>
              <div className="sample-line">
                <span>
                  {source?.sample
                    ? "Stai usando la foto di esempio"
                    : (source?.name ?? "Non sai da dove cominciare?")}
                </span>
                <button disabled={working} onClick={() => void sample()}>
                  {source?.sample ? "Ricarica" : "Prova un esempio"}{" "}
                  <ArrowRight size={12} />
                </button>
              </div>
            </section>

            <section className="settings-section">
              <h2>
                <span className="step-number">02</span> La tua matrice
              </h2>
              <div className="preset-list">
                {[
                  { label: "Piccolo", columns: 32, rows: 40 },
                  { label: "Medio", columns: 64, rows: 80 },
                  { label: "Grande", columns: 96, rows: 120 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    className={
                      settings.columns === preset.columns &&
                      settings.rows === preset.rows
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        columns: preset.columns,
                        rows: preset.rows,
                      }))
                    }
                  >
                    <span>{preset.label}</span>
                    <small>
                      {preset.columns} × {preset.rows}
                    </small>
                  </button>
                ))}
              </div>
              <div className="dimension-inputs">
                <label>
                  <span className="field-label">
                    Colonne <span>N</span>
                  </span>
                  <NumberInput
                    aria-label="Numero di colonne"
                    min={1}
                    max={240}
                    value={settings.columns}
                    onValueChange={(value) => updateDimension("columns", value)}
                  />
                </label>
                <span className="multiply">×</span>
                <label>
                  <span className="field-label">
                    Righe <span>M</span>
                  </span>
                  <NumberInput
                    aria-label="Numero di righe"
                    min={1}
                    max={240}
                    value={settings.rows}
                    onValueChange={(value) => updateDimension("rows", value)}
                  />
                </label>
                <button
                  className={`ratio-button ${locked ? "active" : ""}`}
                  aria-label="Mantieni proporzioni della foto"
                  aria-pressed={locked}
                  title="Mantieni proporzioni della foto durante la modifica"
                  onClick={() => setLocked(!locked)}
                >
                  {locked ? (
                    <LockKeyhole size={16} />
                  ) : (
                    <UnlockKeyhole size={16} />
                  )}
                </button>
              </div>
              <div className="total-line">
                <span>
                  <Layers3 size={14} /> Dadi da preparare
                </span>
                <strong>{number(total)}</strong>
              </div>
              <div className="physical-inputs">
                <label>
                  <span className="field-label">Lato del dado</span>
                  <div className="unit-input">
                    <NumberInput
                      aria-label="Lato del dado in millimetri"
                      min={5}
                      max={50}
                      value={settings.dieSize}
                      onValueChange={(value) => update("dieSize", value)}
                    />
                    <span>mm</span>
                  </div>
                </label>
                <label>
                  <span className="field-label">Spazio tra dadi</span>
                  <div className="unit-input">
                    <NumberInput
                      aria-label="Spazio tra dadi in millimetri"
                      min={0}
                      max={5}
                      step={0.1}
                      value={settings.gap}
                      onValueChange={(value) => update("gap", value)}
                    />
                    <span>mm</span>
                  </div>
                </label>
              </div>
              <div className="fit-select">
                <label className="field-label" htmlFor="fit">
                  Inquadratura
                </label>
                <div>
                  <select
                    id="fit"
                    value={settings.fit}
                    onChange={(event) =>
                      update("fit", event.target.value as Settings["fit"])
                    }
                  >
                    <option value="cover">Ritaglia al centro</option>
                    <option value="contain">Foto intera, con bordi neri</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
            </section>

            <section className="settings-section adjustment-section">
              <h2>
                <span className="step-number">03</span> Luci e dettagli
                <button
                  className="reset-settings"
                  aria-label="Ripristina regolazioni immagine"
                  title="Ripristina regolazioni"
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      brightness: 0,
                      contrast: 15,
                      normalize: true,
                      dither: true,
                    }))
                  }
                >
                  <RotateCcw size={14} />
                </button>
              </h2>
              <label className="slider-field">
                <span>
                  <span>Luminosità</span>
                  <output>
                    {settings.brightness > 0 ? "+" : ""}
                    {settings.brightness}
                  </output>
                </span>
                <input
                  aria-label="Luminosità"
                  type="range"
                  min="-80"
                  max="80"
                  value={settings.brightness}
                  onChange={(event) =>
                    update("brightness", Number(event.target.value))
                  }
                />
              </label>
              <label className="slider-field">
                <span>
                  <span>Contrasto</span>
                  <output>
                    {settings.contrast > 0 ? "+" : ""}
                    {settings.contrast}
                  </output>
                </span>
                <input
                  aria-label="Contrasto"
                  type="range"
                  min="-50"
                  max="100"
                  value={settings.contrast}
                  onChange={(event) =>
                    update("contrast", Number(event.target.value))
                  }
                />
              </label>
              <Toggle
                label="Ottimizza i toni"
                description="Distribuisce il contrasto sulle sei facce"
                checked={settings.normalize}
                onChange={() => update("normalize", !settings.normalize)}
              />
              <Toggle
                label="Sfumature più morbide"
                description="Dithering Floyd–Steinberg"
                checked={settings.dither}
                onChange={() => update("dither", !settings.dither)}
              />
            </section>
            <div className="generate-area">
              <button
                className="primary-button generate-button"
                disabled={!source || working}
                onClick={() => source && void generate(source, settings)}
              >
                {working ? (
                  <>
                    <span className="spinner" /> Elaborazione…
                  </>
                ) : (
                  <>
                    <SlidersHorizontal size={17} />{" "}
                    {dirty ? "Applica e genera" : "Genera il quadro"}{" "}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <p>
                <ShieldCheck size={12} /> Elaborato sul tuo dispositivo. Senza
                AI.
              </p>
            </div>
          </aside>

          <div className="result-column">
            <section
              className="result-panel"
              aria-label="Risultato della conversione"
            >
              <div className="result-heading">
                <div
                  className="view-tabs"
                  role="tablist"
                  aria-label="Vista del progetto"
                >
                  <button
                    id="preview-tab"
                    role="tab"
                    aria-selected={tab === "preview"}
                    aria-controls="project-view"
                    onClick={() => setTab("preview")}
                  >
                    Anteprima
                  </button>
                  <button
                    id="assembly-tab"
                    role="tab"
                    aria-selected={tab === "assembly"}
                    aria-controls="project-view"
                    disabled={!mosaic}
                    onClick={() => setTab("assembly")}
                  >
                    Guida di montaggio <span>{blockCount}</span>
                  </button>
                </div>
                {tab === "preview" && (
                  <label className="original-toggle">
                    <input
                      type="checkbox"
                      checked={original}
                      onChange={() => setOriginal(!original)}
                      disabled={!mosaic}
                    />
                    <span className="original-toggle-box">
                      {original && <Check size={10} />}
                    </span>
                    Foto originale
                  </label>
                )}
              </div>
              <div
                id="project-view"
                role="tabpanel"
                aria-labelledby={
                  tab === "preview" ? "preview-tab" : "assembly-tab"
                }
              >
                {tab === "preview" ? (
                  <Preview
                    mosaic={mosaic}
                    busy={working}
                    original={original}
                    dirty={dirty}
                  />
                ) : (
                  mosaic && <Assembly key={revision} mosaic={mosaic} />
                )}
              </div>
              <div className="result-stats">
                <div>
                  <span className="stat-label">LA MATRICE</span>
                  <strong>
                    {selected.columns} <span>×</span> {selected.rows}
                    <small>dadi</small>
                  </strong>
                </div>
                <div>
                  <span className="stat-label">IL TUO QUADRO</span>
                  <strong>
                    {number(
                      physicalSize(
                        selected.columns,
                        selected.dieSize,
                        selected.gap,
                      ),
                      1,
                    )}{" "}
                    <span>×</span>{" "}
                    {number(
                      physicalSize(
                        selected.rows,
                        selected.dieSize,
                        selected.gap,
                      ),
                      1,
                    )}
                    <small>cm</small>
                  </strong>
                </div>
                <div>
                  <span className="stat-label">DA COSTRUIRE CON</span>
                  <strong>
                    {number(selected.columns * selected.rows)}
                    <small>dadi neri</small>
                  </strong>
                </div>
                <span className="stat-die">
                  <Die size={37} value={5} />
                </span>
              </div>
            </section>

            <section className="face-distribution">
              <div className="distribution-title">
                <h3>Sei facce. Tutte le sfumature.</h3>
                <span>Dadi per ciascuna faccia</span>
              </div>
              <div className="face-counts">
                {[1, 2, 3, 4, 5, 6].map((face) => (
                  <div key={face}>
                    <Die size={30} value={face} />
                    <strong>
                      {mosaic ? number(mosaic.counts[face - 1]) : "—"}
                    </strong>
                    <span>faccia {face}</span>
                  </div>
                ))}
              </div>
              <p>
                <Info size={13} /> Più punti bianchi, più luce. L’anteprima
                simula il contrasto limitato dei dadi reali.
              </p>
            </section>

            <section className="export-panel">
              <div className="export-copy">
                <span className="eyebrow">DALLO SCHERMO ALLE TUE MANI</span>
                <h3>Pronto a prendere forma.</h3>
                <p>
                  Schema numerato, materiali e {blockCount} blocchi da 10 × 10.
                  <br />
                  La tua guida per costruire il quadro, passo dopo passo.
                </p>
                <div className="secondary-downloads">
                  <button
                    disabled={!mosaic || Boolean(exporting)}
                    onClick={() => void download("png")}
                  >
                    <ArrowDownToLine size={14} />
                    {exporting === "png" ? "Esportazione…" : "Anteprima PNG"}
                  </button>
                  <button
                    disabled={!mosaic || Boolean(exporting)}
                    onClick={() => void download("csv")}
                  >
                    <ArrowDownToLine size={14} />
                    Matrice CSV
                  </button>
                </div>
              </div>
              <div className="pdf-action">
                <button
                  className="primary-button"
                  disabled={!mosaic || Boolean(exporting)}
                  onClick={() => void download("pdf")}
                >
                  {exporting === "pdf" ? (
                    <>
                      <span className="spinner" /> PDF {pdfProgress}%
                    </>
                  ) : (
                    <>
                      <FileDown size={17} /> Scarica la guida{" "}
                      <MoveUpRight size={17} />
                    </>
                  )}
                </button>
                <span>PDF stampabile · {blockCount + 1} pagine</span>
                {dirty && <small>Esporta l’ultima anteprima generata.</small>}
              </div>
            </section>
          </div>
        </div>

        <footer className="site-footer">
          <span>
            <Die size={16} value={1} /> Fatto di dadi, pensato per creare.
          </span>
          <span>
            Elaborazione locale <span className="footer-dot">·</span> Nessun
            account <span className="footer-dot">·</span> Nessuna AI
          </span>
          <span className="footer-credit">
            Made with love by{" "}
            <a href="https://a80.it" target="_blank" rel="noopener noreferrer">
              Mircha Emanuel D'Angelo
            </a>
          </span>
          <button onClick={() => setHelp(true)}>
            Il progetto <ArrowRight size={12} />
          </button>
        </footer>
      </main>

      {error && (
        <div className="toast error-toast" role="alert">
          <Info size={18} />
          <span>{error}</span>
          <button aria-label="Chiudi errore" onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast success-toast" role="status">
          <Check size={18} />
          <span>{notice}</span>
          <button aria-label="Chiudi notifica" onClick={() => setNotice("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {help && (
        <Modal
          title="Una foto. Un quadro di dadi."
          close={() => setHelp(false)}
        >
          <div className="help-content">
            <p>
              Un piccolo studio per trasformare fotografie in mosaici di veri
              dadi neri con punti bianchi, a sei facce.
            </p>
            <ol>
              <li>
                <strong>Scegli una foto.</strong> I ritratti e le immagini con
                un soggetto ben definito funzionano particolarmente bene.
              </li>
              <li>
                <strong>Definisci la matrice.</strong> Colonne × righe è il
                numero esatto di dadi. Una matrice più grande conserva più
                dettagli. Inserisci anche la misura dei dadi per conoscere le
                dimensioni del quadro.
              </li>
              <li>
                <strong>Regola e genera.</strong> Puoi migliorare luci e
                contrasto, ritagliare la foto o mantenerla intera. Il dithering
                distribuisce gli errori di tono tra i dadi vicini.
              </li>
              <li>
                <strong>Esplora il risultato.</strong> Usa i pulsanti o la
                rotella per lo zoom, trascina per spostarti. Il 100% adatta il
                quadro allo spazio disponibile. Passa sui dadi per leggerne le
                coordinate.
              </li>
              <li>
                <strong>Costruisci.</strong> Segui la guida interattiva o
                scarica il PDF con schema numerato e orientamento delle facce.
                Il PNG mostra l’anteprima; il CSV contiene l’intera matrice.
              </li>
            </ol>
            <div className="help-note">
              <ShieldCheck size={20} />
              <p>
                Le foto sono elaborate solo in memoria sul tuo dispositivo. Non
                vengono inviate a un server. Il progetto usa Pica (MIT) per il
                ridimensionamento e jsPDF (MIT) per la guida. Nessuna AI.
              </p>
            </div>
            <p className="help-credit">
              Foto di esempio:{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Lange-MigrantMother02.jpg"
                target="_blank"
                rel="noreferrer"
              >
                Migrant Mother, Dorothea Lange, 1936
              </a>
              . Library of Congress / FSA. Immagine di pubblico dominio negli
              Stati Uniti.{" "}
              <a
                href="https://github.com/nodeca/pica"
                target="_blank"
                rel="noreferrer"
              >
                Pica
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/parallax/jsPDF"
                target="_blank"
                rel="noreferrer"
              >
                jsPDF
              </a>
            </p>
            <button className="primary-button" onClick={() => setHelp(false)}>
              Inizia a creare <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
