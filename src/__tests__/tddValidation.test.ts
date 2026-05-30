import { describe, it, expect } from 'vitest';
import { validateTddDocument } from '../tdd/tddTools.js';
import type { TddDocument } from '../tdd/tddSchema.js';

function makeDoc(overrides: Partial<TddDocument> = {}): TddDocument {
  return {
    title: 'Test TDD',
    mode: 'large_feature',
    status: 'Draft',
    owner: 'test-owner',
    reviewers: [],
    sections: [],
    ...overrides,
  };
}

describe('validateTddDocument', () => {
  it('scores 100 when all required sections have content', () => {
    const doc = makeDoc({
      sections: [
        { id: 'summary', heading: 'Overview', content: 'Some content here.', required: true },
        { id: 'goals', heading: 'Goals', content: 'Goal 1, Goal 2.', required: true },
        { id: 'risks', heading: 'Risks', content: 'Low risk.', required: true },
      ],
    });
    const result = validateTddDocument(doc);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.missing).toHaveLength(0);
  });

  it('scores 0 and grade F when all required sections are empty', () => {
    const doc = makeDoc({
      sections: [
        { id: 'summary', heading: 'Overview', content: '<!-- TODO -->', required: true },
        { id: 'goals', heading: 'Goals', content: '<!-- TODO -->', required: true },
      ],
    });
    const result = validateTddDocument(doc);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.missing).toContain('summary');
    expect(result.missing).toContain('goals');
  });

  it('puts optional empty sections in warnings, not missing', () => {
    const doc = makeDoc({
      sections: [
        { id: 'summary', heading: 'Overview', content: 'Content here.', required: true },
        { id: 'appendix', heading: 'Appendix', content: '', required: false },
      ],
    });
    const result = validateTddDocument(doc);
    expect(result.missing).not.toContain('appendix');
    expect(result.warnings).toContain('appendix');
  });

  it('scores 100 on empty sections array (nothing to fail)', () => {
    const doc = makeDoc({ sections: [] });
    const result = validateTddDocument(doc);
    expect(result.score).toBe(100);
  });

  it('checklist reflects complete/incomplete sections', () => {
    const doc = makeDoc({
      sections: [
        { id: 'summary', heading: 'Overview', content: 'Has content', required: true },
        { id: 'goals', heading: 'Goals', content: '', required: true },
      ],
    });
    const result = validateTddDocument(doc);
    const summaryItem = result.checklist.find((c) => c.id === 'summary');
    const goalsItem = result.checklist.find((c) => c.id === 'goals');
    expect(summaryItem?.complete).toBe(true);
    expect(goalsItem?.complete).toBe(false);
  });
});
