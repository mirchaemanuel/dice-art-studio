# Dado — Dice Art Studio

Applicazione web locale in italiano che trasforma una foto in un mosaico di **dadi neri a sei facce con punti bianchi**. Elaborazione classica delle immagini, senza AI, modelli, chiavi API o backend. Le immagini rimangono in memoria nel browser.

## Avvio

Richiede Node.js **22.12 o successivo** e npm.

```sh
npm ci
npm run dev
```

Apri l’indirizzo mostrato dal terminale, normalmente **http://127.0.0.1:5173**.

Per usare la versione compilata:

```sh
npm run build
npm run preview
```

L’app funziona senza connessione Internet una volta installate le dipendenze: foto di esempio, font, codice e librerie vengono serviti localmente. Per l’utilizzo serve il server locale; non aprire direttamente `dist/index.html` con un doppio clic.

## Funzioni

- Caricamento o trascinamento di foto JPG, PNG e WebP, fino a 25 MB e 60 megapixel.
- Matrice personalizzata da **1 × 1 a 240 × 240** (57.600 dadi), con tre formati predefiniti.
- Blocco delle proporzioni della foto durante la modifica delle dimensioni.
- Ritaglio centrale oppure mantenimento dell’intera immagine con bordi neri.
- Luminosità, contrasto, ottimizzazione dei toni e dithering Floyd–Steinberg opzionali.
- Anteprima dei dadi con zoom da 50% a 800%, trascinamento, griglia dei blocchi e confronto con la foto. Il rendering si aggiorna alla risoluzione dello schermo, inclusi i display Retina, e disegna solo i dadi visibili per mantenere limitato l’uso di memoria anche alle matrici più grandi.
- Lettura di riga, colonna e faccia passando il puntatore su un dado.
- Calcolo delle dimensioni fisiche, incluso l’eventuale spazio tra i dadi e senza cornice.
- Conteggio dei dadi da orientare su ciascuna delle sei facce.
- Guida interattiva suddivisa in blocchi da 10 × 10, con coordinate e spunta dei blocchi completati.
- Esportazione di anteprima PNG, matrice CSV e guida PDF A4 stampabile.

Le regolazioni si applicano con **Genera il quadro**. Quando sono presenti modifiche, anteprima ed esportazioni si riferiscono all’ultima generazione: l’interfaccia lo segnala. Cambiare foto genera automaticamente una nuova anteprima.

Il progetto e le spunte di montaggio non vengono salvati tra le sessioni. Le spunte si azzerano chiudendo la scheda della guida o generando un nuovo quadro. Scarica il PDF o il CSV per conservare lo schema.

## Come funziona la conversione

1. Il browser decodifica l’immagine, rispettando l’orientamento supportato dal decoder del dispositivo.
2. Canvas prepara il ritaglio o l’inquadratura intera su fondo nero. Un buffer intermedio limitato riduce l’impiego di memoria.
3. **Pica**, libreria open source con licenza MIT, ridimensiona l’immagine esattamente a N × M pixel, con il filtro predefinito `mks2013`.
4. Un Web Worker calcola la luminanza con pesi Rec. 709 (0,2126 R + 0,7152 G + 0,0722 B, sui canali sRGB). La trasparenza è composta sul nero.
5. L’ottimizzazione facoltativa espande il contrasto tra il 2° e il 98° percentile. Le immagini uniformi conservano il loro tono. Seguono contrasto e luminosità.
6. Ogni pixel viene assegnato a una delle sei facce: **1 = più scuro, 6 = più chiaro**. Il dithering opzionale diffonde l’errore di quantizzazione con scansione serpentina Floyd–Steinberg.
7. Canvas disegna tessere riutilizzabili con dadi neri e punti bianchi. La conversione è deterministica.

**Limite fisico:** anche il dado più scuro ha un punto bianco e quello più chiaro resta prevalentemente nero. La foto viene compressa nei sei toni relativi disponibili. L’anteprima mantiene questo contrasto limitato; non può riprodurre il bianco pieno della foto. Il risultato fisico dipende anche da dimensioni dei punti, finitura e illuminazione dei dadi acquistati. La rotazione delle facce segue la legenda ed è fissa, quindi riproducibile.

## Esportazioni e montaggio

- **PNG:** anteprima senza griglia, fino a 3.840 pixel per lato. Le misure in centimetri si riferiscono al mosaico fisico, non al DPI del PNG.
- **CSV:** UTF-8 con BOM, separatore `;`, intestazione delle colonne e numero di riga. Ogni valore da 1 a 6 indica la faccia visibile. Si legge dall’alto a sinistra, frontalmente, senza specchiare.
- **PDF:** copertina con anteprima, materiali, misure, conteggi e istruzioni; una pagina per ogni blocco da 10 × 10 con coordinate assolute, schema numerico e legenda delle facce. I blocchi sui bordi possono essere più piccoli. Il numero delle pagine è `1 + ceil(N/10) × ceil(M/10)` e viene mostrato prima del download.

Nel PDF le facce 2 e 3 hanno la diagonale dall’alto a sinistra al basso a destra; la faccia 6 ha due colonne verticali. Disponi i dadi con lo stesso orientamento dell’anteprima. Prepara un supporto rigido, verifica a secco i blocchi e utilizza un adesivo compatibile con i materiali scelti.

## Sviluppo e verifica

Stack: React, TypeScript, Vite, Pica, Canvas 2D, Web Workers, jsPDF e Lucide. Font ospitati localmente tramite Fontsource.

```sh
npm test
npm run build
```

Test end-to-end con Playwright:

```sh
npx playwright install chromium
npm run test:e2e
```

I test unitari verificano la mappatura dei toni, il dithering, trasparenza e immagini uniformi, limiti della matrice, conteggi, blocchi incompleti e dimensioni fisiche. I test nel browser verificano caricamento, input, zoom, confronto originale, guida, esportazioni, layout mobile e assenza di richieste esterne. `test-results/` contiene gli export prodotti dal test per eventuali controlli aggiuntivi.

## Struttura

```text
src/App.tsx                    Interfaccia e gestione del progetto
src/components/                Anteprima, guida e controlli
src/lib/engine.ts              Luminanza, quantizzazione, dithering, coordinate
src/lib/image.ts               Decodifica, inquadratura e ridimensionamento Pica
src/lib/processor.worker.ts    Elaborazione della matrice in background
src/lib/render.ts              Rendering Canvas, export PNG e CSV
src/lib/pdf.ts                 Generazione della guida PDF
tests/                        Test del motore e del flusso completo
public/sample.jpg              Foto di esempio disponibile localmente
```

Foto di esempio: **Migrant Mother**, Dorothea Lange, 1936, Library of Congress / Farm Security Administration. Provenienza e licenze: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
