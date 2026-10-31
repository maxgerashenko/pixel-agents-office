import type { AgentAppearance, TabStatus } from './AgentCard.js';
import { AgentCard } from './AgentCard.js';
import { cardVariant } from './cardBar.js';

interface AgentCardBarProps {
  /** Agents to show, top to bottom. */
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
 * are no agents. More cards than fit scroll sideways.
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
  if (agentIds.length === 0) return null;

  return (
    <div className="relative z-20 shrink-0 flex items-start gap-4 px-8 py-4 overflow-x-auto overflow-y-hidden bg-bg border-b-2 border-border">
      {agentIds.map((agentId) => (
        <AgentCard
          key={agentId}
          agentId={agentId}
          variant={cardVariant(agentId, { activeId: activeAgentId, focusedId: focusedAgentId })}
          appearance={getAppearance(agentId)}
          name={getName(agentId)}
          status={statusFor(agentId)}
          onSelect={onSelect}
          onClose={onClose}
        />
      ))}
    </div>
  );
}
