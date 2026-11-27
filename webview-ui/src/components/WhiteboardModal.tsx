import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { WHITEBOARD_MODAL_Z_INDEX, WHITEBOARD_REFRESH_MS } from '../constants.js';
import {
  getIssueBoard,
  isOpenableIssueUrl,
  issueBoardColumns,
  issueBoardShownCount,
  issueDetailsLine,
} from '../office/engine/issueBoard.js';
import { Modal } from './ui/Modal.js';

/** The whiteboard's big view: the GitHub board, one column per Status, kept live while open. */
export function WhiteboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [cards, setCards] = useState(getIssueBoard);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  // Where the tapped card sat, in px from the top of the board wrapper.
  const [tapTop, setTapTop] = useState(0);
  const [detailsTop, setDetailsTop] = useState(0);
  // The tapped card's height: the details row is exactly as tall, so it replaces the card in place.
  const [tapHeight, setTapHeight] = useState(0);

  const selectCard = (id: string, button: HTMLElement) => {
    const wrap = wrapRef.current;
    if (wrap) setTapTop(button.getBoundingClientRect().top - wrap.getBoundingClientRect().top);
    setTapHeight(button.getBoundingClientRect().height);
    setSelectedId(id);
  };

  // Sit the row over the tapped card, kept inside the board and the visible part of its scroller.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const row = detailsRef.current;
    if (!wrap || !row || selectedId === null) return;
    const height = row.offsetHeight;
    let min = 0;
    let max = wrap.offsetHeight - height;
    let scroller: HTMLElement | null = wrap.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight)
      scroller = scroller.parentElement;
    if (scroller) {
      const wrapTop = wrap.getBoundingClientRect().top;
      const view = scroller.getBoundingClientRect();
      min = Math.max(min, view.top - wrapTop);
      max = Math.min(max, view.bottom - wrapTop - height);
    }
    setDetailsTop(Math.max(0, Math.min(tapTop, Math.max(min, max))));
  }, [selectedId, tapTop, tapHeight]);

  useEffect(() => {
    if (!isOpen) return;
    const read = () => setCards(getIssueBoard());
    read();
    setSelectedId(null);
    const timer = window.setInterval(read, WHITEBOARD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const openCount = issueBoardShownCount(cards);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Board (${openCount})`}
      zIndex={WHITEBOARD_MODAL_Z_INDEX}
      className="min-w-[min(960px,100%)]!"
    >
      <div ref={wrapRef} className="relative">
        <div
          data-testid="issue-board"
          onClick={() => setSelectedId(null)}
          className="flex gap-4 px-4 py-4 overflow-x-auto text-text"
        >
          {issueBoardColumns(cards).map((column) => (
            <section
              key={column.status}
              data-testid={`issue-board-column-${column.status}`}
              className="flex-none w-[150px] border-2 border-border bg-bg-dark p-4"
            >
              <h3 className="m-0 mb-4 text-base text-accent-bright">
                {column.label} <span className="text-text-muted">({column.cards.length})</span>
              </h3>
              <ul className="m-0 p-0 list-none">
                {column.cards.map((card) => (
                  <li key={card.id} className="mb-4">
                    <button
                      type="button"
                      title={card.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCard(card.id, e.currentTarget);
                      }}
                      className="w-full text-left text-sm bg-bg border-2 border-border p-4 cursor-pointer hover:border-accent"
                      style={{ lineHeight: 1.3 }}
                    >
                      <span className="text-accent-bright">#{card.number} </span>
                      {card.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {selected && (
          <div
            ref={detailsRef}
            data-testid="issue-details"
            style={{ top: detailsTop, height: tapHeight }}
            className="absolute inset-x-0 z-10 flex items-center gap-[8px] border-2 border-border bg-bg-dark px-[12px] py-[4px] text-text overflow-hidden box-border"
          >
            <div className="flex-1 min-w-0">
              <div
                className="text-sm overflow-hidden"
                style={{
                  lineHeight: 1.2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                <span className="text-accent-bright">#{selected.number} </span>
                {selected.title}
              </div>
              <div className="text-xs text-text-muted truncate">{issueDetailsLine(selected)}</div>
            </div>
            <button
              type="button"
              data-testid="issue-open-github"
              disabled={!isOpenableIssueUrl(selected.url)}
              onClick={() => window.open(selected.url, '_blank', 'noopener,noreferrer')}
              className="flex-none text-sm bg-bg border-2 border-border px-[10px] py-[4px] cursor-pointer hover:border-accent"
            >
              Open on GitHub
            </button>
            <button
              type="button"
              data-testid="issue-details-close"
              aria-label="Close details"
              onClick={() => setSelectedId(null)}
              className="flex-none text-sm bg-bg border-2 border-border px-[10px] py-[4px] cursor-pointer hover:border-accent"
            >
              X
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
