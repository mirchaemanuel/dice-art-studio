import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck } from "lucide-react";
import { getBlocks } from "../lib/engine";
import type { Mosaic } from "../lib/engine";
import { Die } from "./Die";

export function Assembly({ mosaic }: { mosaic: Mosaic }) {
  const { columns, rows } = mosaic.settings;
  const blocks = useMemo(() => getBlocks(columns, rows), [columns, rows]);
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const block = blocks[active];
  const toggle = () =>
    setCompleted((previous) => {
      const next = new Set(previous);
      if (next.has(active)) next.delete(active);
      else next.add(active);
      return next;
    });
  return (
    <div className="assembly">
      <div className="assembly-heading">
        <div>
          <span className="eyebrow">UN DADO ALLA VOLTA</span>
          <h3>Dal progetto al quadro.</h3>
        </div>
        <span className="assembly-progress">
          <CheckCheck size={16} /> {completed.size} / {blocks.length} blocchi
        </span>
      </div>
      <p className="assembly-intro">
        Parti dall’alto a sinistra, guardando il quadro frontalmente. Ogni
        numero indica la faccia del dado rivolta verso di te. Mantieni
        l’orientamento della legenda.
      </p>
      <div className="assembly-body">
        <div className="block-selector">
          <span className="field-label">Scegli un blocco</span>
          <div
            className="block-map"
            style={{
              gridTemplateColumns: `repeat(${Math.ceil(columns / 10)}, minmax(0, 1fr))`,
            }}
          >
            {blocks.map((item) => (
              <button
                key={item.index}
                className={`${active === item.index ? "selected" : ""} ${completed.has(item.index) ? "completed" : ""}`}
                aria-label={`Blocco ${item.index + 1}${completed.has(item.index) ? ", completato" : ""}`}
                aria-pressed={active === item.index}
                onClick={() => setActive(item.index)}
              >
                {completed.has(item.index) ? (
                  <Check size={12} />
                ) : (
                  item.index + 1
                )}
              </button>
            ))}
          </div>
          <span className="block-map-note">
            I progressi restano visibili finché questa guida è aperta.
          </span>
        </div>
        <div className="block-detail">
          <div className="block-header">
            <div>
              <h4>
                Blocco {active + 1}
                <span> / {blocks.length}</span>
              </h4>
              <p>
                Righe {block.y + 1}–{block.y + block.height} · Colonne{" "}
                {block.x + 1}–{block.x + block.width}
              </p>
            </div>
            <div className="block-nav">
              <button
                className="icon-button"
                aria-label="Blocco precedente"
                disabled={active === 0}
                onClick={() => setActive(active - 1)}
              >
                <ArrowLeft size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Blocco successivo"
                disabled={active === blocks.length - 1}
                onClick={() => setActive(active + 1)}
              >
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
          <div className="number-grid-wrap">
            <table
              className="number-grid"
              aria-label={`Schema numerico del blocco ${active + 1}`}
            >
              <thead>
                <tr>
                  <th scope="col">↓ / →</th>
                  {Array.from({ length: block.width }, (_, x) => (
                    <th key={x} scope="col">
                      {block.x + x + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: block.height }, (_, y) => (
                  <tr key={y}>
                    <th scope="row">{block.y + y + 1}</th>
                    {Array.from({ length: block.width }, (_, x) => (
                      <td
                        key={x}
                        title={`Riga ${block.y + y + 1}, colonna ${block.x + x + 1}`}
                      >
                        {mosaic.faces[(block.y + y) * columns + block.x + x]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className={`complete-button ${completed.has(active) ? "completed" : ""}`}
            onClick={toggle}
          >
            <Check size={16} />
            {completed.has(active)
              ? "Blocco completato"
              : "Segna come completato"}
          </button>
        </div>
      </div>
      <div className="assembly-legend">
        <span>Orientamento delle facce</span>
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <div key={face}>
            <Die value={face} size={26} />
            <span>{face}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
