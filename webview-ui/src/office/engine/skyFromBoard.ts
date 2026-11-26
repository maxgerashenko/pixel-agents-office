/**
 * The sky shows the board's issues. Pure: maps each board card to a sky task, dropping the
 * statuses that have no place in the sky (New, Blocked).
 */
import type { IssueBoardCardView } from './issueBoard.js';
import type { SkyTask, SkyTaskStage } from './skyTasks.js';

function skyStageOfCard(card: IssueBoardCardView): SkyTaskStage | null {
  switch (card.status) {
    case 'needs_design':
      return card.progress === 'plan_ready' ? 'plan_ready' : 'designing';
    case 'in_progress':
      return card.progress === 'testing' ? 'testing' : 'coding';
    case 'ready':
      return 'ready';
    case 'in_review':
      return 'in_review';
    case 'needs_decision':
      return 'needs_decision';
    case 'done':
      return 'done';
    default:
      return null;
  }
}

export function skyTasksFromBoard(cards: IssueBoardCardView[]): SkyTask[] {
  const tasks: SkyTask[] = [];
  for (const card of cards) {
    const stage = skyStageOfCard(card);
    if (stage) tasks.push({ id: card.id, title: card.title, stage, url: card.url });
  }
  return tasks;
}
