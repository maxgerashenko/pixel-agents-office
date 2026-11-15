import { useRef } from 'react';

import { MUSIC_BUTTON_NOTE, MUSIC_BUTTON_SCALE } from '../constants.js';
import { useHourlyMusic } from '../music/useHourlyMusic.js';

/**
 * Music on/off, top-right beside the sky button. Plays the YouTube track set in
 * Settings, kept in step with the real clock (position into the track follows
 * the minutes past the hour). The tap is also the one gesture iOS needs before
 * it lets the page make sound.
 */
export function MusicButton({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const { configured, on, toggle } = useHourlyMusic(host);
  const cols = MUSIC_BUTTON_NOTE[0].length + 1;
  return (
    <>
      {/* Not display:none — iOS refuses to play from a hidden player. */}
      <div
        ref={host}
        aria-hidden="true"
        className="fixed bottom-0 left-0 w-1 h-1 overflow-hidden opacity-0 pointer-events-none"
      />
      <button
        data-testid="music-toggle"
        data-music={configured ? (on ? 'on' : 'off') : 'unset'}
        aria-label={on ? 'Stop the music' : 'Play the music'}
        aria-pressed={on}
        title={
          configured
            ? on
              ? 'Music on, synced to the hour. Tap to stop'
              : 'Tap to play music, synced to the hour'
            : 'Add a YouTube link in Settings to play music'
        }
        disabled={!configured}
        className={`bg-transparent border-0 p-4 select-none text-text ${
          configured ? 'cursor-pointer' : 'cursor-default opacity-40'
        } ${on ? '' : 'opacity-70'} ${className}`}
        onClick={toggle}
      >
        <svg
          width={cols * MUSIC_BUTTON_SCALE}
          height={MUSIC_BUTTON_NOTE.length * MUSIC_BUTTON_SCALE}
          viewBox={`0 0 ${cols} ${MUSIC_BUTTON_NOTE.length}`}
          shapeRendering="crispEdges"
          aria-hidden="true"
          className="music-note"
        >
          {MUSIC_BUTTON_NOTE.flatMap((row, y) =>
            [...row].map((ch, x) =>
              ch === 'x' ? (
                <rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
              ) : null,
            ),
          )}
        </svg>
      </button>
    </>
  );
}
