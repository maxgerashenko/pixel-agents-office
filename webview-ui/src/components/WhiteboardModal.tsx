import { useEffect, useState } from 'react';

import { WHITEBOARD_MODAL_Z_INDEX, WHITEBOARD_REFRESH_MS } from '../constants.js';
import {
  getIssueBoard,
  isOpenableIssueUrl,
  issueBoardColumns,
  issueBoardShownCount,
} from '../office/engine/issueBoard.js';
import { Modal } from './ui/Modal.js';

/** The whiteboard's big view: the GitHub board, one column per Status, kept live while open. */
export function WhiteboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [cards, setCards] = useState(getIssueBoard);

  useEffect(() => {
    if (!isOpen) return;
    const read = () => setCards(getIssueBoard());
    read();
    const timer = window.setInterval(read, WHITEBOARD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  const openCount = issueBoardShownCount(cards);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Board (${openCount})`}
      zIndex={WHITEBOARD_MODAL_Z_INDEX}
      className="min-w-[min(960px,100%)]!"
    >
      <div data-testid="issue-board" className="flex gap-4 px-4 py-4 overflow-x-auto text-text">
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
                    disabled={!isOpenableIssueUrl(card.url)}
                    onClick={() => window.open(card.url, '_blank', 'noopener,noreferrer')}
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
    </Modal>
  );
}
