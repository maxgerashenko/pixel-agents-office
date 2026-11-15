import { useCallback, useEffect, useRef, useState } from 'react';

import {
  SKY_BUTTON_BALLOON,
  SKY_BUTTON_CHECK_MS,
  SKY_BUTTON_ISS,
  SKY_BUTTON_PALETTE,
  SKY_BUTTON_SCALE,
} from '../constants.js';
import {
  holdSkyFastForward,
  skyAt,
  skyFractionNow,
  skyOverride,
} from '../office/engine/skyCycle.js';

/** A pixel sprite from rows of palette characters, as crisp SVG rects. */
function PixelSprite({ rows }: { rows: readonly string[] }) {
  const cols = rows[0].length;
  return (
    <svg
      width={cols * SKY_BUTTON_SCALE}
      height={rows.length * SKY_BUTTON_SCALE}
      viewBox={`0 0 ${cols} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : (
            <rect
              key={`${x}:${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={SKY_BUTTON_PALETTE[ch]}
            />
          ),
        ),
      )}
    </svg>
  );
}

/**
 * Top-right sky control, drawn as something that belongs up there: a hot air
 * balloon by day, the ISS by night. Hold it and the day/night cycle runs
 * ahead; let go and it runs back to the real time twice as fast. A quick tap
 * plays one full cycle. The sky itself lives in the canvas — this only tells
 * it whether the button is held, and asks it whether it is night.
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

  const isNight = (): boolean =>
    skyAt(skyOverride() ?? skyFractionNow(new Date())).starAlpha >= 0.5;
  const [night, setNight] = useState(isNight);
  useEffect(() => {
    const id = setInterval(() => setNight(isNight()), SKY_BUTTON_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <button
      data-testid="sky-fast-forward"
      data-sky={night ? 'night' : 'day'}
      aria-label="Fast-forward the sky"
      title="Hold to fast-forward the day and night"
      className={`bg-transparent border-0 p-4 cursor-pointer select-none touch-none ${className}`}
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
      <PixelSprite rows={night ? SKY_BUTTON_ISS : SKY_BUTTON_BALLOON} />
    </button>
  );
}
