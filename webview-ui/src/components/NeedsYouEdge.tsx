interface NeedsYouEdgeProps {
  /** Agents with an open permission prompt; nothing renders when empty. */
  agentIds: readonly number[];
}

/** A pulsing amber glow round the screen edge while an agent needs a
 *  permission answer. Purely visual: pointer-events none, so taps, pan and
 *  pinch reach the office and terminal beneath it untouched. */
export function NeedsYouEdge({ agentIds }: NeedsYouEdgeProps) {
  if (agentIds.length === 0) return null;
  return <div className="needs-you-edge" data-needs-you={agentIds.length} aria-hidden="true" />;
}
