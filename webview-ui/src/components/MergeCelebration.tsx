import { useEffect, useRef } from 'react';

import {
  SKY_BUTTON_SCALE,
  SKY_MERGE_FLYER_PX,
  SKY_MERGE_QUEUE_MAX,
  SKY_MERGE_Z_INDEX,
} from '../constants.js';
import { type CelebrationKind, celebrationSec } from '../office/engine/mergeCelebration.js';
import { drawCelebration } from '../office/engine/mergeCelebrationDraw.js';
import { onSkyMerge, setCelebrating } from '../office/engine/mergeCelebrationEvents.js';

const BUTTON_SELECTOR = '[data-testid="sky-fast-forward"]';

/**
 * Plays the merge celebration over the sky button when a pull request merges: a full-screen canvas
 * that takes no clicks. Merges that land while one is playing wait their turn.
 */
export function MergeCelebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let queued = 0;
    let playing: { kind: CelebrationKind; start: number } | null = null;
    let raf = 0;

    const frame = (now: number): void => {
      raf = 0;
      const button = document.querySelector<HTMLElement>(BUTTON_SELECTOR);
      const art = button?.querySelector('svg');
      if (!playing || !button || !art) {
        // nothing to play it on (debug view): drop it
        playing = null;
        queued = 0;
        setCelebrating(false);
        return;
      }
      const t = (now - playing.start) / 1000;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(window.innerWidth * dpr);
      const h = Math.round(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        const r = art.getBoundingClientRect();
        const unit = SKY_BUTTON_SCALE * dpr;
        drawCelebration(
          ctx,
          playing.kind,
          t,
          { x: (r.left + r.width / 2) * dpr, y: (r.top + r.height / 2) * dpr },
          unit,
          SKY_MERGE_FLYER_PX * dpr,
          {
            left: (r.left + r.width / 2) / SKY_BUTTON_SCALE,
            right: (window.innerWidth - r.left - r.width / 2) / SKY_BUTTON_SCALE,
          },
        );
      }
      if (t >= celebrationSec(playing.kind)) {
        ctx?.clearRect(0, 0, w, h);
        playing = null;
        setCelebrating(false);
        if (queued > 0) start();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const start = (): void => {
      const button = document.querySelector<HTMLElement>(BUTTON_SELECTOR);
      if (!button || queued <= 0) {
        queued = 0;
        return;
      }
      queued--;
      playing = {
        kind: button.dataset.sky === 'night' ? 'night' : 'day',
        start: performance.now(),
      };
      setCelebrating(true);
      raf = requestAnimationFrame(frame);
    };

    const off = onSkyMerge((count) => {
      queued = Math.min(SKY_MERGE_QUEUE_MAX, queued + count);
      if (!playing) start();
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
      setCelebrating(false);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: SKY_MERGE_Z_INDEX }}
    />
  );
}
