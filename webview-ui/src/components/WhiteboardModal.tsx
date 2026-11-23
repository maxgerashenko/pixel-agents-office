import { useEffect, useState } from 'react';

import { WHITEBOARD_MODAL_Z_INDEX, WHITEBOARD_REFRESH_MS } from '../constants.js';
import { getSkyTasks } from '../office/engine/skyTasks.js';
import { whiteboardEntries } from '../office/engine/whiteboard.js';
import { Modal } from './ui/Modal.js';

const STAGE_LABEL: Record<string, string> = {
  plan: 'plan',
  coding: 'coding',
  tests: 'tests',
  review: 'review',
  ready_to_merge: 'ready to merge',
};

/** The whiteboard's list: every active task with its pull request number, kept live while open. */
export function WhiteboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState(() => whiteboardEntries(getSkyTasks()));

  useEffect(() => {
    if (!isOpen) return;
    const read = () => setEntries(whiteboardEntries(getSkyTasks()));
    read();
    const timer = window.setInterval(read, WHITEBOARD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Active tasks (${entries.length})`}
      zIndex={WHITEBOARD_MODAL_Z_INDEX}
    >
      <div data-testid="whiteboard-list" className="px-10 py-4 text-base text-text">
        {entries.length === 0 ? (
          <p className="text-text-muted m-0">No active tasks.</p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {entries.map((e) => (
              <li key={e.id} className="mb-6" style={{ lineHeight: 1.3 }}>
                {e.pr !== null && <span className="text-accent-bright">#{e.pr} </span>}
                <span>{e.title}</span>
                <span className="text-text-muted text-sm"> · {STAGE_LABEL[e.stage] ?? e.stage}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
