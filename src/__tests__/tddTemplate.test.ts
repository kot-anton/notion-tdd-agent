import { describe, it, expect } from 'vitest';
import { getSectionsForMode, MODE_SECTIONS } from '../tdd/tddTemplate.js';

describe('getSectionsForMode', () => {
  it('returns 18 sections for large_feature', () => {
    const sections = getSectionsForMode('large_feature');
    expect(sections).toHaveLength(18);
  });

  it('returns fewer sections for small_feature than large_feature', () => {
    const small = getSectionsForMode('small_feature');
    const large = getSectionsForMode('large_feature');
    expect(small.length).toBeLessThan(large.length);
  });

  it('every section has required id, heading, description, and defaultContent', () => {
    for (const mode of Object.keys(MODE_SECTIONS) as Array<keyof typeof MODE_SECTIONS>) {
      for (const section of getSectionsForMode(mode)) {
        expect(section.id).toBeTruthy();
        expect(section.heading).toBeTruthy();
        expect(section.description).toBeTruthy();
        expect(typeof section.required).toBe('boolean');
      }
    }
  });

  it('large_feature includes all key section headings', () => {
    const sections = getSectionsForMode('large_feature');
    const headings = sections.map((s) => s.heading);
    expect(headings).toContain('Overview');
    expect(headings).toContain('Proposed Solution');
    expect(headings).toContain('Testing Plan');
    expect(headings).toContain('Risks / Open Questions');
  });

  it('incident_followup does not include non_goals', () => {
    const sections = getSectionsForMode('incident_followup');
    const ids = sections.map((s) => s.id);
    expect(ids).not.toContain('non_goals');
  });
});
