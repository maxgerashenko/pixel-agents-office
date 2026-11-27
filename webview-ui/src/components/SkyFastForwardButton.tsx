import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  SKY_BUTTON_BALLOON,
  SKY_BUTTON_CHECK_MS,
  SKY_BUTTON_ISS,
  SKY_BUTTON_PALETTE,
  SKY_BUTTON_SCALE,
  SYNC_FLAME_INNER_COLOR,
  SYNC_FLAME_OUTER_COLOR,
  SYNC_LAMP_DIM_COLOR,
  SYNC_LAMP_FLASH_COLOR,
} from '../constants.js';
import { isCelebrating, subscribeCelebrating } from '../office/engine/mergeCelebrationEvents.js';
import {
  holdSkyFastForward,
  skyAt,
  skyFractionNow,
  skyOverride,
} from '../office/engine/skyCycle.js';
import { getSyncState, syncLampColor } from '../office/engine/skySync.js';

/** A pixel sprite from rows of palette characters, as crisp SVG rects. */
function PixelSprite({ rows, children }: { rows: readonly string[]; children?: React.ReactNode }) {
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
      {children}
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

  // the Mac board sync's heartbeat: the balloon's burner and the ISS lights follow its tick
  const [lamp, setLamp] = useState(() => syncLampColor(getSyncState(), Date.now()));
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setLamp(syncLampColor(getSyncState(), Date.now()));
      setBeat((b) => b + 1);
    }, SKY_BUTTON_CHECK_MS);
    return () => clearInterval(id);
  }, []);
  const flashing = lamp === SYNC_LAMP_FLASH_COLOR;
  const resting = lamp === SYNC_LAMP_DIM_COLOR;

  // a merge celebration draws the sprite itself, so the button's own steps aside
  const celebrating = useSyncExternalStore(subscribeCelebrating, isCelebrating);

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
      <span className={celebrating ? 'invisible' : ''}>
        <PixelSprite rows={night ? SKY_BUTTON_ISS : SKY_BUTTON_BALLOON}>
          {lamp && !night && (
            <>
              <rect
                x={resting ? 5 : 4}
                y={flashing ? 10 : resting ? 12 : 11 - (beat % 2)}
                width={resting ? 1 : 3}
                height={flashing ? 3 : resting ? 1 : 2 + (beat % 2)}
                fill={SYNC_FLAME_OUTER_COLOR}
                fillOpacity={resting ? 0.55 : 1}
              />
              {!resting && (
                <rect
                  x={5}
                  y={flashing ? 11 : 12 - (beat % 2)}
                  width={1}
                  height={flashing ? 2 : 1 + (beat % 2)}
                  fill={flashing ? lamp : SYNC_FLAME_INNER_COLOR}
                />
              )}
            </>
          )}
          {lamp && night && (
            <>
              <rect x={8} y={2} width={1} height={1} fill={lamp} />
              <rect x={8} y={6} width={1} height={1} fill={lamp} />
              {!resting && <rect x={0} y={0} width={1} height={1} fill={lamp} />}
              {!resting && <rect x={16} y={6} width={1} height={1} fill={lamp} />}
              {flashing && <rect x={1} y={1} width={1} height={1} fill={lamp} />}
              {flashing && <rect x={15} y={5} width={1} height={1} fill={lamp} />}
            </>
          )}
        </PixelSprite>
      </span>
    </button>
  );
}
