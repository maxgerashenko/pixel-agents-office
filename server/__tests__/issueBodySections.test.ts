import { describe, expect, it } from 'vitest';

import {
  decisionsOfSection,
  sectionsOfIssueBody,
  tickDecisionOption,
} from '../src/issueBodySections.js';

const NEW_LAYOUT = `## Before / After
- Before: a
- After: b

## Done when
It works.

## Blocked by
#12, #13

## Decision needed
**Which db?**
- [ ] A (recommended): sqlite
- [ ] B: postgres

**Ship now?**
- [ ] yes
- [x] no

## Scope
- May touch: x

## Verify
- [ ] run it
`;

describe('sectionsOfIssueBody', () => {
  it('reads every ## section of the new layout', () => {
    const sections = sectionsOfIssueBody(NEW_LAYOUT);
    expect(sections.beforeAfter).toBe('- Before: a\n- After: b');
    expect(sections.doneWhen).toBe('It works.');
    expect(sections.blockedBy).toBe('#12, #13');
    expect(sections.scope).toBe('- May touch: x');
    expect(sections.verify).toBe('- [ ] run it');
    expect(sections.decisionNeeded).toContain('**Which db?**');
  });

  it('reads the old **Name:** line layout', () => {
    const sections = sectionsOfIssueBody('**Done when:** it ships\n**Blocked by:** none\n');
    expect(sections.doneWhen).toBe('it ships');
    expect(sections.blockedBy).toBe('none');
  });

  it('gives an empty string for a missing section and for an empty or missing body', () => {
    expect(sectionsOfIssueBody('just text').doneWhen).toBe('');
    expect(sectionsOfIssueBody('').beforeAfter).toBe('');
    expect(sectionsOfIssueBody(undefined).verify).toBe('');
  });
});

describe('decisionsOfSection', () => {
  it('returns one entry per question with its options, recommended and ticked marked', () => {
    const decisions = decisionsOfSection(sectionsOfIssueBody(NEW_LAYOUT).decisionNeeded);
    expect(decisions).toEqual([
      {
        question: 'Which db?',
        options: [
          { label: 'A (recommended): sqlite', recommended: true, ticked: false },
          { label: 'B: postgres', recommended: false, ticked: false },
        ],
      },
      {
        question: 'Ship now?',
        options: [
          { label: 'yes', recommended: false, ticked: false },
          { label: 'no', recommended: false, ticked: true },
        ],
      },
    ]);
  });

  it('returns nothing for an empty section or the word none', () => {
    expect(decisionsOfSection('')).toEqual([]);
    expect(decisionsOfSection('none')).toEqual([]);
  });
});

describe('tickDecisionOption', () => {
  it('ticks the chosen option, unticks the others of that question and leaves the rest alone', () => {
    const next = tickDecisionOption(NEW_LAYOUT, 1, 0);
    expect(next).not.toBeNull();
    const decisions = decisionsOfSection(sectionsOfIssueBody(next).decisionNeeded);
    expect(decisions[0].options.map((o) => o.ticked)).toEqual([false, false]);
    expect(decisions[1].options.map((o) => o.ticked)).toEqual([true, false]);
    expect(next!.startsWith('## Before / After')).toBe(true);
    expect(next).toContain('## Done when\nIt works.');
  });

  it('returns null for a missing section or an index out of range', () => {
    expect(tickDecisionOption('## Done when\nx', 0, 0)).toBeNull();
    expect(tickDecisionOption(NEW_LAYOUT, 5, 0)).toBeNull();
    expect(tickDecisionOption(NEW_LAYOUT, 0, 9)).toBeNull();
  });
});
