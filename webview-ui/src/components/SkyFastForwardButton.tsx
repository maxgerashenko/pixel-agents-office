import { useCallback, useEffect, useRef } from 'react';

import { holdSkyFastForward } from '../office/engine/skyCycle.js';
import { Button } from './ui/Button.js';

/**
 * Top-right sky control. Hold it and the day/night cycle runs ahead, a whole
 * hour every five seconds; let go and it runs back to the real time twice as
 * fast. A quick tap plays one full cycle. The sky itself lives in the canvas —
 * this only tells it whether the button is held.
 */
export function SkyFastForwardButton({ className = '' }: { className?: string }) {
  const held = useRef(false);
  const set = useCallback((next: boolean) => {
    if (held.current === next) return;
    held.current = next;
    holdSkyFastForward(next);
  }, []);
  // never leave the sky running if the button goes away mid-press
  useEffect(() => () => set(false), [set]);

  return (
    <div data-testid="sky-fast-forward" className={`pixel-panel p-4 ${className}`}>
      <Button
        aria-label="Fast-forward the sky"
        title="Hold to fast-forward the day and night"
        className="select-none touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          set(true);
        }}
        onPointerUp={() => set(false)}
        onPointerCancel={() => set(false)}
        onLostPointerCapture={() => set(false)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') set(true);
        }}
        onKeyUp={() => set(false)}
        onBlur={() => set(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {'>>'}
      </Button>
    </div>
  );
}
