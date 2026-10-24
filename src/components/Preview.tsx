import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Grid2X2,
  Maximize,
  Minus,
  Plus,
  Scan,
  MousePointer2,
} from "lucide-react";
import type { Mosaic } from "../lib/engine";
import { drawMosaicViewport } from "../lib/render";

interface Props {
  mosaic: Mosaic | null;
  busy: boolean;
  original: boolean;
  dirty: boolean;
}

export function Preview({ mosaic, busy, original, dirty }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bounds, setBounds] = useState({ width: 700, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [grid, setGrid] = useState(false);
  const [pixelRatio, setPixelRatio] = useState(
    () => window.devicePixelRatio || 1,
  );
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    face: number;
  } | null>(null);
  const dragging = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHover(null);
  };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
      setPixelRatio(window.devicePixelRatio || 1);
    });
    const updatePixelRatio = () => setPixelRatio(window.devicePixelRatio || 1);
    const resolution = window.matchMedia(`(resolution: ${pixelRatio}dppx)`);
    resolution.addEventListener("change", updatePixelRatio);
    window.addEventListener("resize", updatePixelRatio);
    observer.observe(element);
    return () => {
      observer.disconnect();
      resolution.removeEventListener("change", updatePixelRatio);
      window.removeEventListener("resize", updatePixelRatio);
    };
  }, [pixelRatio]);
  useEffect(reset, [mosaic]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) =>
        Math.max(0.5, Math.min(8, current * Math.exp(-event.deltaY * 0.002))),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const columns = mosaic?.settings.columns ?? 64;
  const rows = mosaic?.settings.rows ?? 80;
  const fitCell = Math.max(
    0.1,
    Math.min((bounds.width - 96) / columns, (bounds.height - 70) / rows),
  );
  const cell = fitCell * zoom;
  const width = columns * cell;
  const height = rows * cell;
  const offsetX = (bounds.width - width) / 2 + pan.x;
  const offsetY = (bounds.height - height) / 2 + pan.y;
  useLayoutEffect(() => {
    if (canvas.current && mosaic && !original) {
      drawMosaicViewport(canvas.current, mosaic, {
        width: bounds.width,
        height: bounds.height,
        cell,
        offsetX,
        offsetY,
        pixelRatio,
        grid,
      });
    }
  }, [mosaic, original, bounds, cell, offsetX, offsetY, pixelRatio, grid]);
  return (
    <div className="preview-shell">
      <div
        className={`preview-viewport ${busy ? "is-busy" : ""}`}
        ref={viewport}
        role="region"
        aria-label="Anteprima del quadro: trascina per spostare, usa lo zoom per ingrandire"
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            (event.target as HTMLElement).closest("button")
          )
            return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = {
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
        }}
        onPointerMove={(event) => {
          if (dragging.current) {
            setPan({
              x: dragging.current.panX + event.clientX - dragging.current.x,
              y: dragging.current.panY + event.clientY - dragging.current.y,
            });
            setHover(null);
          } else if (mosaic && viewport.current && !original) {
            const rect = viewport.current.getBoundingClientRect();
            const x = Math.floor((event.clientX - rect.left - offsetX) / cell);
            const y = Math.floor((event.clientY - rect.top - offsetY) / cell);
            setHover(
              x >= 0 && x < columns && y >= 0 && y < rows
                ? { x, y, face: mosaic.faces[y * columns + x] }
                : null,
            );
          }
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
        onPointerLeave={() => {
          setHover(null);
        }}
        onDoubleClick={reset}
      >
        <span className="viewport-label">
          <span className="status-dot" />{" "}
          {original ? "FOTOGRAFIA ORIGINALE" : "ANTEPRIMA DEL QUADRO"}
        </span>
        {dirty && !busy && (
          <span className="dirty-badge">Modifiche da applicare</span>
        )}
        {mosaic ? (
          <>
            <canvas
              ref={canvas}
              className={`mosaic-viewport ${original ? "hidden-canvas" : ""}`}
              role="img"
              aria-label={`Mosaico di ${columns} per ${rows} dadi neri con punti bianchi`}
            />
            <div
              className="artwork-position"
              style={{
                width,
                height,
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
              }}
            >
              <span className="measure measure-top">{columns} dadi</span>
              <span className="measure measure-left">{rows} dadi</span>
              <div className="artwork-frame">
                {original && (
                  <img
                    draggable={false}
                    src={mosaic.sourceUrl}
                    alt="Fotografia originale"
                    style={{ objectFit: mosaic.settings.fit }}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-preview">
            <Scan size={38} />
            <p>Il tuo prossimo quadro inizia qui.</p>
            <span>Carica una foto o prova l’esempio.</span>
          </div>
        )}
        {busy && (
          <div className="processing-overlay">
            <span className="spinner" />
            <span>Un dado alla volta…</span>
          </div>
        )}
        {hover && !busy && (
          <div className="cell-readout">
            Riga {hover.y + 1} <span>·</span> Colonna {hover.x + 1}{" "}
            <span>·</span> Faccia <b>{hover.face}</b>
          </div>
        )}
      </div>
      <div className="preview-toolbar">
        <span className="pan-hint">
          <MousePointer2 size={14} /> Trascina per esplorare
        </span>
        <div className="zoom-tools">
          <button
            className={`icon-button ${grid ? "active" : ""}`}
            aria-label="Mostra griglia dei blocchi"
            aria-pressed={grid}
            onClick={() => setGrid(!grid)}
            title="Griglia 10 × 10"
          >
            <Grid2X2 size={17} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="icon-button"
            aria-label="Riduci zoom"
            onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}
          >
            <Minus size={17} />
          </button>
          <span className="zoom-value" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="icon-button"
            aria-label="Aumenta zoom"
            onClick={() => setZoom((z) => Math.min(8, z * 1.25))}
          >
            <Plus size={17} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="icon-button"
            aria-label="Adatta anteprima"
            title="Adatta (doppio clic sul quadro)"
            onClick={reset}
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
