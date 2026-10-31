import { AGENT_CARD_NAME_MAX_WIDTH_PX, MUGSHOT_DISPLAY_PX } from '../constants.js';
import type { CardVariant } from './cardBar.js';
import { cardShortName } from './cardBar.js';
import { CharacterMugShot } from './CharacterMugShot.js';
import { Button } from './ui/Button.js';

/** How a given agent's character looks, for the tab mug shot. */
export interface AgentAppearance {
  palette: number;
  hueShift: number;
}

/** Agent activity reflected by the tab's status dot. */
export type AgentActivity = 'idle' | 'working' | 'attention';

/** Activity plus the drawer-owned "connection broken" state. */
export type TabStatus = AgentActivity | 'disconnected';

const STATUS_DOT: Record<TabStatus, string> = {
  idle: 'bg-status-success', // green — turn complete, nothing pending
  working: 'bg-accent-bright', // blue — actively running
  attention: 'bg-status-permission', // yellow — needs permission or input
  disconnected: 'bg-status-error', // red — terminal socket dropped
};

const CARD_VARIANT: Record<CardVariant, string> = {
  default: 'bg-bg/70 border-transparent hover:bg-btn-hover/80',
  focused: 'bg-active-bg/75 border-transparent',
  active: 'bg-active-bg/75 border-accent',
};

interface AgentCardProps {
  agentId: number;
  variant: CardVariant;
  appearance: AgentAppearance;
  /** The agent's name, drawn inside the card to the left of the mug shot.
   *  Omitted (mobile) = no name block, the card is unchanged. */
  name?: string;
  status: TabStatus | null;
  /** When false the × is invisible (not removed — the card keeps its width so
   *  the bar doesn't reflow). Mobile only shows it on the active terminal tab
   *  to keep a stray tap from killing an agent. */
  showClose?: boolean;
  onSelect: (agentId: number) => void;
  onClose: (agentId: number) => void;
}

/** One agent's card in the terminal sidebar — mug shot beside a
 *  close-button/status-dot column. The cards double as the terminal panel's
 *  tabs: clicking one selects that agent's pane. */
export function AgentCard({
  agentId,
  variant,
  appearance,
  name,
  status,
  showClose = true,
  onSelect,
  onClose,
}: AgentCardProps) {
  const named = name !== undefined;
  return (
    <div
      // Named (desktop bar): its own `1fr | mug shot | 1fr` grid. The two fr
      // columns stay equal, so the name (spanning all three, row 2) centres
      // under the mug shot, which sits beside the close/status column as
      // before; a long name widens both sides alike and runs under that
      // column. Unnamed (mobile): the plain flex row.
      className={`pointer-events-auto p-1 cursor-pointer border-2 shrink-0 ${named ? 'grid' : 'flex items-stretch gap-1'} ${CARD_VARIANT[variant]}`}
      style={named ? { gridTemplateColumns: `1fr ${MUGSHOT_DISPLAY_PX}px 1fr` } : undefined}
      onClick={() => onSelect(agentId)}
      title={name ?? `Agent ${agentId}`}
    >
      <div className={named ? 'col-start-2 row-start-1' : undefined}>
        <CharacterMugShot palette={appearance.palette} hueShift={appearance.hueShift} />
      </div>
      {named && (
        <span
          className="col-span-3 row-start-2 min-w-0 truncate text-center text-2xs leading-none text-text px-8 pt-2"
          style={{ maxWidth: AGENT_CARD_NAME_MAX_WIDTH_PX }}
        >
          {cardShortName(name)}
        </span>
      )}
      {/* Close on top, status dot at the bottom, both centred over the
          same column beside the mug shot, which sets its height. */}
      <div
        className={`flex flex-col items-center justify-between shrink-0 self-start ${named ? 'col-start-3 row-start-1 justify-self-start ml-1' : ''}`}
        style={{ height: MUGSHOT_DISPLAY_PX }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            // Don't also select the tab we're about to remove.
            e.stopPropagation();
            onClose(agentId);
          }}
          title="Close agent"
          className={`leading-none ${showClose ? '' : 'invisible'}`}
        >
          ×
        </Button>
        {/* 1px left: optically centres the solid square under the pixel-font ×
            glyph, which sits a hair left in its cell. mb (not pb) lifts it off
            the card's bottom edge: the span is a fixed-size empty box, so
            padding is invisible — only margin moves it. */}
        <span
          className={`size-6 shrink-0 relative -left-1 mb-2 ${status ? STATUS_DOT[status] : ''}`}
        />
      </div>
    </div>
  );
}
