/**
 * Reads the sections of a prototypeRAG issue body (the layout of its issue template and
 * scripts/issue_lint.py): `## Name` headings first, then the old `**Name:** value` line.
 */

export interface IssueBodySections {
  beforeAfter: string;
  doneWhen: string;
  blockedBy: string;
  decisionNeeded: string;
  scope: string;
  verify: string;
}

export interface DecisionOption {
  label: string;
  recommended: boolean;
  ticked: boolean;
}

export interface DecisionQuestion {
  question: string;
  options: DecisionOption[];
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** The text of one section ('' when absent): the `## Name` block, else the `**Name:**` line. */
function readSection(body: string, name: string): string {
  const escaped = escapeForRegExp(name);
  const heading = new RegExp(
    `^## ${escaped}[ \\t]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`,
    'im',
  ).exec(body);
  if (heading) return heading[1].trim();
  const line = new RegExp(`^\\*\\*${escaped}:\\*\\*[ \\t]*(.*)$`, 'im').exec(body);
  return line ? line[1].trim() : '';
}

/** Pure: the six sections the card shows; '' for a missing section or a missing body. */
export function sectionsOfIssueBody(body: string | undefined | null): IssueBodySections {
  const text = body ?? '';
  return {
    beforeAfter: readSection(text, 'Before / After'),
    doneWhen: readSection(text, 'Done when'),
    blockedBy: readSection(text, 'Blocked by'),
    decisionNeeded: readSection(text, 'Decision needed'),
    scope: readSection(text, 'Scope'),
    verify: readSection(text, 'Verify'),
  };
}

/** Pure: the questions of a `## Decision needed` section, same rules as scripts/decision_tick.py. */
export function decisionsOfSection(sectionText: string): DecisionQuestion[] {
  const questions: DecisionQuestion[] = [];
  for (const rawLine of sectionText.split('\n')) {
    const line = rawLine.trim();
    const bold = /^\*\*(.+?)\*\*$/.exec(line);
    const box = /^- \[([ xX])\][ \t]*(.*)$/.exec(line);
    if (bold) questions.push({ question: bold[1], options: [] });
    else if (box && questions.length > 0) {
      questions[questions.length - 1].options.push({
        label: box[2],
        recommended: /recommended/i.test(box[2]),
        ticked: box[1] !== ' ',
      });
    }
  }
  return questions.filter((question) => question.options.length > 0);
}

/**
 * Pure: the body with option `optionIndex` of question `questionIndex` ticked and that
 * question's other boxes unticked (same question numbering as `decisionsOfSection`).
 * null when the body has no `## Decision needed` section or the indexes do not exist.
 */
export function tickDecisionOption(
  body: string,
  questionIndex: number,
  optionIndex: number,
): string | null {
  const heading = /^## Decision needed[ \t]*$/im.exec(body);
  if (!heading) return null;
  const lines = body.split('\n');
  let line = body.slice(0, heading.index).split('\n').length; // first line after the heading
  const questions: number[][] = [];
  for (; line < lines.length && !/^## /.test(lines[line]); line++) {
    const text = lines[line].trim();
    if (/^\*\*(.+?)\*\*$/.test(text)) questions.push([]);
    else if (/^- \[[ xX]\]/.test(text) && questions.length > 0)
      questions[questions.length - 1].push(line);
  }
  const boxes = questions.filter((question) => question.length > 0)[questionIndex];
  if (!boxes || optionIndex < 0 || optionIndex >= boxes.length) return null;
  boxes.forEach((lineIndex, index) => {
    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*- )\[[ xX]\]/,
      index === optionIndex ? '$1[x]' : '$1[ ]',
    );
  });
  return lines.join('\n');
}
