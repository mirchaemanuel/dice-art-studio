import { quantize } from "./engine";
import type { Settings } from "./engine";

self.onmessage = (
  event: MessageEvent<{ rgba: Uint8ClampedArray; settings: Settings }>,
) => {
  try {
    const result = quantize(event.data.rgba, event.data.settings);
    self.postMessage(result, { transfer: [result.faces.buffer] });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Elaborazione non riuscita.",
    });
  }
};
