import { describe, it, expect } from 'vitest';
import {
  getSystemOverviewSections,
  SYSTEM_OVERVIEW_SECTIONS,
} from '../tdd/systemOverviewTemplate.js';
import { detectDocumentType } from '../tdd/tddTools.js';
import { getSectionsForMode } from '../tdd/tddTemplate.js';

// ─── Smoke Test 1: System Overview template structure ─────────────────────────

describe('System Overview Template', () => {
  it('has exactly 15 sections', () => {
    const sections = getSystemOverviewSections();
    expect(sections).toHaveLength(15);
  });

  it('includes all required section IDs', () => {
    const ids = getSystemOverviewSections().map((s) => s.id);
    expect(ids).toContain('product_vision');
    expect(ids).toContain('problem_context');
    expect(ids).toContain('what_we_are_building');
    expect(ids).toContain('core_capabilities');
    expect(ids).toContain('product_architecture');
    expect(ids).toContain('core_modules');
    expect(ids).toContain('data_ownership_privacy');
    expect(ids).toContain('mvp_scope');
    expect(ids).toContain('open_questions');
    expect(ids).toContain('child_tdds');
    expect(ids).toContain('appendix');
  });

  it('all sections have required fields', () => {
    for (const section of getSystemOverviewSections()) {
      expect(section.id).toBeTruthy();
      expect(section.heading).toBeTruthy();
      expect(section.description).toBeTruthy();
      expect(typeof section.required).toBe('boolean');
      expect(typeof section.defaultContent).toBe('string');
    }
  });

  it('marks critical sections as required', () => {
    const requiredIds = SYSTEM_OVERVIEW_SECTIONS.filter((s) => s.required).map((s) => s.id);
    expect(requiredIds).toContain('product_vision');
    expect(requiredIds).toContain('core_modules');
    expect(requiredIds).toContain('mvp_scope');
    expect(requiredIds).toContain('open_questions');
  });

  it('marks appendix, future_roadmap, and ai_strategy as optional', () => {
    const optionalIds = SYSTEM_OVERVIEW_SECTIONS.filter((s) => !s.required).map((s) => s.id);
    expect(optionalIds).toContain('appendix');
    expect(optionalIds).toContain('future_roadmap');
    expect(optionalIds).toContain('ai_strategy');
  });
});

// ─── Smoke Test 2: TDD template unchanged ────────────────────────────────────

describe('TDD template (unchanged)', () => {
  it('large_feature still has exactly 18 sections', () => {
    const sections = getSectionsForMode('large_feature');
    expect(sections).toHaveLength(18);
  });

  it('large_feature still includes TDD-specific headings', () => {
    const headings = getSectionsForMode('large_feature').map((s) => s.heading);
    expect(headings).toContain('Overview');
    expect(headings).toContain('Proposed Solution');
    expect(headings).toContain('Testing Plan');
    expect(headings).toContain('Risks / Open Questions');
  });
});

// ─── Smoke Test 3: Document type detection ───────────────────────────────────

describe('detectDocumentType', () => {
  // System overview keywords
  it('detects "system overview" as system_overview', () => {
    expect(detectDocumentType('Create a system overview for AI Platform')).toBe('system_overview');
  });

  it('detects "product overview" as system_overview', () => {
    expect(detectDocumentType('Generate a product overview')).toBe('system_overview');
  });

  it('detects "product architecture overview" as system_overview', () => {
    expect(detectDocumentType('Write a product architecture overview for my platform')).toBe('system_overview');
  });

  it('detects "platform overview" as system_overview', () => {
    expect(detectDocumentType('Create a platform overview document')).toBe('system_overview');
  });

  it('detects "what we are building" as system_overview', () => {
    expect(detectDocumentType('Document what we are building')).toBe('system_overview');
  });

  it('detects "project overview" as system_overview', () => {
    expect(detectDocumentType('Write a project overview')).toBe('system_overview');
  });

  // TDD keywords
  it('detects "TDD" as tdd', () => {
    expect(detectDocumentType('Create a TDD for the data ingestion pipeline')).toBe('tdd');
  });

  it('detects "technical design document" as tdd', () => {
    expect(detectDocumentType('Generate a technical design document for auth')).toBe('tdd');
  });

  it('detects "design doc for feature" as tdd', () => {
    expect(detectDocumentType('Write a design doc for the notifications feature')).toBe('tdd');
  });

  it('detects "module design" as tdd', () => {
    expect(detectDocumentType('Create a module design for the Claude pipeline')).toBe('tdd');
  });

  // Feature Design keywords
  it('detects "feature design" as feature_design', () => {
    expect(detectDocumentType('Create a feature design for the notifications module')).toBe('feature_design');
  });

  it('detects "capability design" as feature_design', () => {
    expect(detectDocumentType('Write a capability design for user authentication')).toBe('feature_design');
  });

  it('detects "capability overview" as feature_design', () => {
    expect(detectDocumentType('Generate a capability overview for the calling assistant')).toBe('feature_design');
  });

  it('detects "workflow design" as feature_design', () => {
    expect(detectDocumentType('Create a workflow design for the approval flow')).toBe('feature_design');
  });

  it('detects "business logic for" as feature_design', () => {
    expect(detectDocumentType('Document the business logic for the action approval system')).toBe('feature_design');
  });

  // Internal README keywords
  it('detects "readme" as internal_readme', () => {
    expect(detectDocumentType('Update the readme for the project')).toBe('internal_readme');
  });

  it('detects "setup guide" as internal_readme', () => {
    expect(detectDocumentType('Create a setup guide for new developers')).toBe('internal_readme');
  });

  it('detects "developer guide" as internal_readme', () => {
    expect(detectDocumentType('Write a developer guide for the onboarding process')).toBe('internal_readme');
  });

  it('detects "installation guide" as internal_readme', () => {
    expect(detectDocumentType('Create an installation guide for the CLI tool')).toBe('internal_readme');
  });

  it('detects "getting started guide" as internal_readme', () => {
    expect(detectDocumentType('Write a getting started guide for the MCP server')).toBe('internal_readme');
  });

  // Unknown
  it('returns unknown for ambiguous input', () => {
    expect(detectDocumentType('Write a document about something')).toBe('unknown');
  });

  // Case-insensitivity
  it('is case-insensitive for system_overview', () => {
    expect(detectDocumentType('Create a SYSTEM OVERVIEW')).toBe('system_overview');
    expect(detectDocumentType('Create a System Overview')).toBe('system_overview');
  });

  it('is case-insensitive for tdd', () => {
    expect(detectDocumentType('Write a TDD please')).toBe('tdd');
    expect(detectDocumentType('write a tdd please')).toBe('tdd');
  });

  it('is case-insensitive for feature_design', () => {
    expect(detectDocumentType('Create a FEATURE DESIGN for auth')).toBe('feature_design');
    expect(detectDocumentType('Create a Feature Design for auth')).toBe('feature_design');
  });

  it('is case-insensitive for internal_readme', () => {
    expect(detectDocumentType('Update the README file')).toBe('internal_readme');
    expect(detectDocumentType('Write a SETUP GUIDE')).toBe('internal_readme');
  });

  // Priority: system_overview wins over feature_design if both match
  it('system_overview takes priority over feature_design when both keywords present', () => {
    expect(detectDocumentType('System overview with feature design sections')).toBe('system_overview');
  });
});

// ─── Smoke Test 4: Child TDD title formatting ────────────────────────────────

describe('child TDD title formatting', () => {
  const prefix = (title: string) =>
    title.startsWith('TDD —') || title.startsWith('TDD - ') ? title : `TDD — ${title}`;

  it('formats module name as child TDD title', () => {
    expect(prefix('Data Ingestion Pipeline')).toBe('TDD — Data Ingestion Pipeline');
    expect(prefix('User-Owned Storage')).toBe('TDD — User-Owned Storage');
    expect(prefix('AI Processing Pipeline')).toBe('TDD — AI Processing Pipeline');
  });

  it('does not double-prefix a title already starting with "TDD —"', () => {
    expect(prefix('TDD — Auth Module')).toBe('TDD — Auth Module');
  });

  it('does not double-prefix a title starting with "TDD - " (hyphen variant)', () => {
    expect(prefix('TDD - Notifications')).toBe('TDD - Notifications');
  });
});
