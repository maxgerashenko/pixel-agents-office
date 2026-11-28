import { useEffect, useState } from 'react';

import { WHITEBOARD_MODAL_Z_INDEX, WHITEBOARD_REFRESH_MS } from '../constants.js';
import {
  getIssueBoard,
  isOpenableIssueUrl,
  issueBoardColumns,
  issueBoardShownCount,
  issueDetailSections,
  issueDetailsLine,
} from '../office/engine/issueBoard.js';
import { transport } from '../transport/index.js';
import { Modal } from './ui/Modal.js';

/** The whiteboard's big view: the GitHub board, one column per Status, kept live while open. */
export function WhiteboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [cards, setCards] = useState(getIssueBoard);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sentOptionKey, setSentOptionKey] = useState<string | null>(null);
  const selectCard = (id: string) => setSelectedId(id);

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
      <div className="relative" style={{ minHeight: selected ? 'min(70vh, 640px)' : undefined }}>
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
                        selectCard(card.id);
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
            data-testid="issue-details"
            className="absolute inset-0 z-10 flex flex-col gap-[12px] border-2 border-border bg-bg-dark p-[12px] text-text overflow-y-auto box-border"
          >
            <div className="flex flex-col gap-[8px] w-full">
              <div className="text-sm" style={{ lineHeight: 1.2 }}>
                <span className="text-accent-bright">#{selected.number} </span>
                {selected.title}
              </div>
              <div className="text-xs text-text-muted">{issueDetailsLine(selected)}</div>
              {issueDetailSections(selected).map((section) =>
                section.collapsed ? (
                  <details key={section.label} className="text-xs">
                    <summary className="cursor-pointer text-text-muted">{section.label}</summary>
                    <div className="whitespace-pre-wrap">{section.text}</div>
                  </details>
                ) : (
                  <div key={section.label} className="text-xs">
                    <div className="text-text-muted">{section.label}</div>
                    <div className={`whitespace-pre-wrap ${section.missing ? 'text-red-400' : ''}`}>
                      {section.missing ? 'missing' : section.text}
                    </div>
                  </div>
                ),
              )}
            </div>
            <div data-testid="issue-option-buttons" className="flex flex-col gap-[8px] w-full">
              {selected.details.decisions.flatMap((decision, questionIndex) => [
                <div key={`q-${decision.question}`} className="text-xs text-text-muted">
                  {decision.question}
                </div>,
                ...decision.options.map((option, optionIndex) => {
                  const optionKey = `${selected.id}-${questionIndex}-${optionIndex}`;
                  return (
                    <button
                      key={`${decision.question}-${option.label}`}
                      type="button"
                      data-testid="issue-option"
                      title="Ticks this answer on the issue on GitHub"
                      onClick={() => {
                        setSentOptionKey(optionKey);
                        transport.send({
                          type: 'tickIssueDecisionOption',
                          cardId: selected.id,
                          questionIndex,
                          optionIndex,
                        });
                      }}
                      className={`w-full min-h-[44px] text-left text-sm bg-bg border-2 px-[10px] py-[6px] cursor-pointer hover:border-accent ${option.recommended ? 'border-accent' : 'border-border'}`}
                    >
                      {sentOptionKey === optionKey && !option.ticked ? '[...] ' : ''}
                      {option.ticked ? '[x] ' : ''}
                      {option.label}
                    </button>
                  );
                }),
              ])}
            </div>
            <div className="flex-none flex gap-[8px] order-first self-end">
              <button
                type="button"
                data-testid="issue-open-github"
                disabled={!isOpenableIssueUrl(selected.url)}
                onClick={() => window.open(selected.url, '_blank', 'noopener,noreferrer')}
                className="w-[130px] text-sm bg-bg border-2 border-border px-[10px] py-[4px] cursor-pointer hover:border-accent"
              >
                Open on GitHub
              </button>
              <button
                type="button"
                data-testid="issue-details-close"
                aria-label="Close details"
                onClick={() => setSelectedId(null)}
                className="w-[130px] text-sm bg-bg border-2 border-border px-[10px] py-[4px] cursor-pointer hover:border-accent"
              >
                X
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
