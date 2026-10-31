import { serverToken } from '../transport/serverToken.js';

interface ReadOnlyNoticeProps {
  /** Mobile: top-left, where the floating Settings button would be. */
  isMobile: boolean;
}

/**
 * Stands in for the controls a read-only office hides (+ Agent, Layout,
 * Settings). It sits where those controls would be and says how to get them
 * back, because a bare "View only" label read as missing UI: the panel simply
 * vanished and nothing pointed at the cause.
 *
 * The page cannot fetch the token for the user — the server never hands it out
 * over HTTP (see transport/serverToken.ts) — so the notice can only point at
 * the URL the server printed. It does know whether this page carried a token at
 * all, which separates "opened bare" from "the token was refused" (rotated
 * token, or a host name the server wasn't started to accept).
 */
export function ReadOnlyNotice({ isMobile }: ReadOnlyNoticeProps) {
  const position = isMobile ? 'mobile-safe-top left-8' : 'left-10 bottom-10';
  return (
    <div
      className={`absolute ${position} z-20 pixel-panel py-6 px-12 text-sm max-w-[340px]`}
      data-testid="read-only-notice"
    >
      <div className="text-text mb-2">View only</div>
      <div className="text-text-muted" style={{ lineHeight: 1.3 }}>
        {serverToken === null
          ? 'Settings and the other controls need the full link the server printed, the one ending in ?token=…'
          : 'This link’s token was not accepted: it changed, or this address is not allowed. Open the link the server printed at its last start.'}
      </div>
    </div>
  );
}
