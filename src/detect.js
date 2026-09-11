import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

/** COCO classes that count as "a screen you should not be looking at". */
export const SCREEN_CLASSES = new Set(['tv', 'laptop']);

const MAX_BOXES = 8;
const FLOOR = 0.05; // detect everything above this, filter by the live threshold later

export async function loadDetector() {
  await tf.ready();
  const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  return async function detect(video) {
    const preds = await model.detect(video, MAX_BOXES, FLOOR);
    // bbox is [x, y, w, h] in video pixels
    return preds.map((p) => ({ cls: p.class, score: p.score, box: p.bbox }));
  };
}

/**
 * Runs `detect` in a loop at roughly `fps`, never overlapping calls.
 * Returns a stop function.
 */
export function startDetectionLoop({ video, detect, fps = 6, onResult, onError }) {
  const interval = 1000 / fps;
  let stopped = false;

  (async function loop() {
    while (!stopped) {
      const started = performance.now();
      if (video.readyState >= 2) {
        try {
          onResult(await detect(video));
        } catch (err) {
          onError?.(err);
        }
      }
      const wait = Math.max(0, interval - (performance.now() - started));
      await new Promise((r) => setTimeout(r, wait));
    }
  })();

  return () => {
    stopped = true;
  };
}
