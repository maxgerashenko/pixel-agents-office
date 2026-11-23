import { useEffect } from 'react';

import { SKY_BUTTON_CHECK_MS } from '../constants.js';
import { skyFractionNow, skyOverride } from '../office/engine/skyCycle.js';
import { needsYouSkyIsNight } from './needsYou.js';

interface NeedsYouEdgeProps {
  /** Agents with an open permission prompt; nothing renders when empty. */
  agentIds: readonly number[];
}

/** A pulsing glow round the screen edge while an agent needs a permission
 *  answer: pink at night, purple by day (it also tints the waiting card, via a
 *  data attribute on <html>). Purely visual: pointer-events none, so taps, pan
 *  and pinch reach the office and terminal beneath it untouched. */
export function NeedsYouEdge({ agentIds }: NeedsYouEdgeProps) {
  const active = agentIds.length > 0;
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const sync = () => {
      const night = needsYouSkyIsNight(skyOverride() ?? skyFractionNow(new Date()));
      root.dataset.needsYouSky = night ? 'night' : 'day';
    };
    sync();
    const id = setInterval(sync, SKY_BUTTON_CHECK_MS);
    return () => clearInterval(id);
  }, [active]);
  if (!active) return null;
  return <div className="needs-you-edge" data-needs-you={agentIds.length} aria-hidden="true" />;
}
