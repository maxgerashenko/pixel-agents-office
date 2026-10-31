import type { WheelEvent as ReactWheelEvent } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { CARD_ROW_REORDER_MS } from '../constants.js';
import type { AgentAppearance, TabStatus } from './AgentCard.js';
import { AgentCard } from './AgentCard.js';
import { activeFirstOrder, cardVariant, isActiveCardStatus, sameOrder } from './cardBar.js';

interface AgentCardBarProps {
  /** Agents to show, in creation order (the row reorders them, see below). */
  agentIds: number[];
  /** The agent whose terminal pane is showing (standalone). Its card gets the
   *  accent border. */
  activeAgentId?: number | null;
  /** The agent whose character is selected in the office. Its card gets the
   *  active background; `activeAgentId` wins when both name the same agent. */
  focusedAgentId?: number | null;
  getAppearance: (agentId: number) => AgentAppearance;
  /** The name shown on each card. */
  getName: (agentId: number) => string;
  statusFor: (agentId: number) => TabStatus | null;
  onSelect: (agentId: number) => void;
  onClose: (agentId: number) => void;
}

/**
 * The row of agent cards across the top of the desktop window, directly under
 * the usage strip — one mug shot, name and status dot per agent — shared by
 * both desktop hosts.
 *
 * A full-width strip that takes its own layout row (like the usage strip
 * above it), so it never covers the office; nothing, and no row, when there
 * are no agents. More cards than fit scroll sideways, with no visible
 * scrollbar (trackpad swipe, or the mouse wheel, which scrolls the row).
 *
 * Order: an agent that becomes active (working, or waiting on the user)
 * slides to the front; one that goes idle stays where it is. The slide is a
 * FLIP animation — cards are measured before and after the reorder and eased
 * from the old spot to the new one.
 *
 * In standalone with a terminal, the cards double as the terminal panel's
 * tabs (App passes the agents with a PTY and the shown pane as active). In VS
 * Code, or a watch-only standalone session, the bar lists every agent in the
 * office, external sessions included; a card click raises that agent's
 * terminal where there is one.
 */
export function AgentCardBar({
  agentIds,
  activeAgentId = null,
  focusedAgentId = null,
  getAppearance,
  getName,
  statusFor,
  onSelect,
  onClose,
}: AgentCardBarProps) {
  const [order, setOrder] = useState<number[]>(agentIds);
  const wasActiveRef = useRef<Set<number>>(new Set());
  const nodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  // Card positions measured just before a reorder: the FLIP "first" frame.
  const firstRectsRef = useRef<Map<number, DOMRect> | null>(null);

  // statusFor is a fresh function each render; this key changes only when a
  // status or the agent list actually does.
  const statusKey = agentIds.map((id) => `${id}:${statusFor(id) ?? ''}`).join(',');

  useEffect(() => {
    const nowActive = agentIds.filter((id) => isActiveCardStatus(statusFor(id)));
    const becameActive = nowActive.filter((id) => !wasActiveRef.current.has(id));
    wasActiveRef.current = new Set(nowActive);
    setOrder((prev) => {
      const next = activeFirstOrder(prev, agentIds, becameActive);
      if (sameOrder(prev, next)) return prev;
      const rects = new Map<number, DOMRect>();
      for (const [id, node] of nodesRef.current) rects.set(id, node.getBoundingClientRect());
      firstRectsRef.current = rects;
      return next;
    });
    // statusKey stands in for agentIds + statusFor (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey]);

  useLayoutEffect(() => {
    const first = firstRectsRef.current;
    firstRectsRef.current = null;
    if (!first) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (const [id, node] of nodesRef.current) {
      const before = first.get(id);
      if (!before) continue;
      const dx = before.left - node.getBoundingClientRect().left;
      if (dx === 0) continue;
      // Invert: jump back to the old spot, then play: ease to the new one.
      node.style.transition = 'none';
      node.style.transform = `translateX(${dx}px)`;
      void node.offsetWidth;
      node.style.transition = `transform ${CARD_ROW_REORDER_MS}ms ease-out`;
      node.style.transform = '';
    }
  }, [order]);

  // A plain mouse wheel only scrolls vertically; turn it sideways so the row
  // scrolls without a scrollbar. Trackpads already send deltaX.
  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.deltaX !== 0 || e.deltaY === 0) return;
    e.currentTarget.scrollLeft += e.deltaY;
  };

  if (agentIds.length === 0) return null;

  // Until the effect has merged a newly added agent into `order`, show it at
  // the end rather than dropping it for a frame.
  const shown = activeFirstOrder(order, agentIds, []);

  return (
    <div
      className="relative z-20 shrink-0 flex items-start gap-4 px-8 py-4 overflow-x-auto overflow-y-hidden no-scrollbar bg-bg border-b-2 border-border"
      onWheel={handleWheel}
    >
      {shown.map((agentId) => (
        <div
          key={agentId}
          className="shrink-0"
          ref={(node) => {
            if (node) nodesRef.current.set(agentId, node);
            else nodesRef.current.delete(agentId);
          }}
        >
          <AgentCard
            agentId={agentId}
            variant={cardVariant(agentId, { activeId: activeAgentId, focusedId: focusedAgentId })}
            appearance={getAppearance(agentId)}
            name={getName(agentId)}
            status={statusFor(agentId)}
            onSelect={onSelect}
            onClose={onClose}
          />
        </div>
      ))}
    </div>
  );
}
