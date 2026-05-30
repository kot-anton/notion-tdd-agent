import { describe, it, expect } from 'vitest';
import {
  runQualityGate,
  classifyContent,
  type SectionSnapshot,
  type DocumentTypeCategory,
} from '../tdd/documentQualityGate.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSection(heading: string, content: string): SectionSnapshot {
  return { heading, content };
}

function makeSections(contentMap: Record<string, string>): SectionSnapshot[] {
  return Object.entries(contentMap).map(([heading, content]) => makeSection(heading, content));
}

// ─── classifyContent ─────────────────────────────────────────────────────────

describe('classifyContent', () => {
  it('detects env variable names as internal setup content', () => {
    expect(classifyContent('Set NOTION_TOKEN in your environment').hasInternalSetupContent).toBe(true);
    expect(classifyContent('Add OPENAI_API_KEY to .env').hasInternalSetupContent).toBe(true);
    expect(classifyContent('Configure SUPABASE_URL and SUPABASE_KEY').hasInternalSetupContent).toBe(true);
  });

  it('detects npm commands as internal setup content', () => {
    expect(classifyContent('Run npm install to get started').hasInternalSetupContent).toBe(true);
    expect(classifyContent('Execute npm run build').hasInternalSetupContent).toBe(true);
    expect(classifyContent('Use npm publish to release').hasInternalSetupContent).toBe(true);
  });

  it('detects npx commands as internal setup content', () => {
    expect(classifyContent('npx notion-tdd-agent init').hasInternalSetupContent).toBe(true);
  });

  it('detects MCP / Claude CLI setup as internal content', () => {
    expect(classifyContent('Run claude mcp add-json to register').hasInternalSetupContent).toBe(true);
  });

  it('detects HTTP endpoint specs as TDD implementation detail', () => {
    expect(classifyContent('GET /api/users returns a list').hasTddImplementationDetail).toBe(true);
    expect(classifyContent('POST /auth/login with body').hasTddImplementationDetail).toBe(true);
  });

  it('detects HTTP error codes as TDD implementation detail', () => {
    expect(classifyContent('Returns HTTP 404 when not found').hasTddImplementationDetail).toBe(true);
    expect(classifyContent('status: 500 on server error').hasTddImplementationDetail).toBe(true);
  });

  it('detects database DDL as TDD implementation detail', () => {
    expect(classifyContent('CREATE TABLE users (id uuid)').hasTddImplementationDetail).toBe(true);
    expect(classifyContent('ALTER TABLE sessions ADD COLUMN').hasTddImplementationDetail).toBe(true);
  });

  it('detects marketing language', () => {
    expect(classifyContent('This will revolutionize the workflow').hasMarketingLanguage).toBe(true);
    expect(classifyContent('A true game-changer in the market').hasMarketingLanguage).toBe(true);
  });

  it('detects unsafe privacy claims', () => {
    expect(classifyContent('Company has no access to user data').hasUnsafePrivacyClaims).toBe(true);
    expect(classifyContent('The platform is fully private').hasUnsafePrivacyClaims).toBe(true);
    expect(classifyContent('Data never leaves the user device').hasUnsafePrivacyClaims).toBe(true);
    expect(classifyContent('System is secure by design').hasUnsafePrivacyClaims).toBe(true);
  });

  it('detects image placeholder blocks', () => {
    expect(classifyContent('📸 Image Placeholder — Architecture Diagram').hasImagePlaceholders).toBe(true);
  });

  it('returns all false for clean product description text', () => {
    const clean =
      'Our platform helps users capture and process meeting notes automatically. ' +
      'It uses AI to extract action items and sync them to your calendar.';
    const result = classifyContent(clean);
    expect(result.hasInternalSetupContent).toBe(false);
    expect(result.hasTddImplementationDetail).toBe(false);
    expect(result.hasMarketingLanguage).toBe(false);
    expect(result.hasUnsafePrivacyClaims).toBe(false);
    expect(result.hasImagePlaceholders).toBe(false);
  });
});

// ─── runQualityGate — System Overview ────────────────────────────────────────

describe('runQualityGate — system_overview', () => {
  const type: DocumentTypeCategory = 'system_overview';

  it('passes with clean product-level content', () => {
    const sections = makeSections({
      'Product Vision': 'We help teams capture knowledge and turn it into action.',
      'What We Are Building':
        'A mobile app that records meetings and generates structured summaries using AI.',
      'Core Modules':
        '| Module | Responsibility | Status |\n|---|---|---|\n| Input Capture | Record audio | MVP |\n| AI Processing | Summarize | MVP |',
    });
    const result = runQualityGate(sections, type);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('raises an error when a section contains environment variable names', () => {
    const sections = makeSections({
      'What We Are Building': 'Set NOTION_TOKEN and OPENAI_API_KEY in your .env file to start.',
    });
    const result = runQualityGate(sections, type);
    const errorIssues = result.issues.filter((i) => i.severity === 'error');
    expect(errorIssues.length).toBeGreaterThan(0);
    expect(errorIssues[0].code).toBe('INTERNAL_CONTENT_IN_OVERVIEW');
    expect(result.passed).toBe(false);
  });

  it('raises an error when a section contains npm commands', () => {
    const sections = makeSections({
      'Product Architecture': 'Run npm install, then npm run build to start the server.',
    });
    const result = runQualityGate(sections, type);
    const errorIssues = result.issues.filter((i) => i.severity === 'error');
    expect(errorIssues.length).toBeGreaterThan(0);
    expect(errorIssues[0].code).toBe('INTERNAL_CONTENT_IN_OVERVIEW');
    expect(result.passed).toBe(false);
  });

  it('raises an error when a section contains MCP setup commands', () => {
    const sections = makeSections({
      'AI Strategy': 'Use claude mcp add-json to register the server.',
    });
    const result = runQualityGate(sections, type);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'INTERNAL_CONTENT_IN_OVERVIEW')).toBe(true);
  });

  it('warns when the overview contains HTTP endpoint specs (TDD detail)', () => {
    const sections = makeSections({
      'Product Architecture':
        'The API exposes GET /api/users and POST /api/sessions endpoints.',
    });
    const result = runQualityGate(sections, type);
    expect(result.issues.some((i) => i.code === 'TDD_DETAIL_IN_OVERVIEW')).toBe(true);
  });

  it('warns on unsafe absolute privacy claims in system overview', () => {
    const sections = makeSections({
      'Data Ownership':
        'The company has no access to user data and data never leaves the device.',
    });
    const result = runQualityGate(sections, type);
    expect(result.issues.some((i) => i.code === 'UNSAFE_PRIVACY_CLAIM')).toBe(true);
  });

  it('notes image placeholder presence as info', () => {
    const sections = makeSections({
      'Product Architecture': '📸 Image Placeholder — Architecture Diagram\nPrompt: show components',
    });
    const result = runQualityGate(sections, type);
    expect(result.issues.some((i) => i.code === 'IMAGE_PLACEHOLDER_PRESENT')).toBe(true);
    expect(result.issues.find((i) => i.code === 'IMAGE_PLACEHOLDER_PRESENT')?.severity).toBe('info');
  });

  it('identifies the offending section in the error', () => {
    const sections = makeSections({
      'Product Vision': 'We build AI tools.',
      'What We Are Building': 'Add NOTION_TOKEN to .env to configure the server.',
    });
    const result = runQualityGate(sections, type);
    const issue = result.issues.find((i) => i.code === 'INTERNAL_CONTENT_IN_OVERVIEW');
    expect(issue?.section).toBe('What We Are Building');
  });

  it('passes with cautious privacy language', () => {
    const sections = makeSections({
      'Data Ownership':
        'The platform is designed so that user data is stored in user-owned infrastructure. ' +
        'The target model ensures company systems do not access conversation content.',
    });
    const result = runQualityGate(sections, type);
    expect(result.issues.filter((i) => i.code === 'UNSAFE_PRIVACY_CLAIM')).toHaveLength(0);
  });
});

// ─── runQualityGate — TDD ─────────────────────────────────────────────────────

describe('runQualityGate — tdd', () => {
  const type: DocumentTypeCategory = 'tdd';

  it('passes with clean technical content', () => {
    const sections = makeSections({
      Overview: 'This module handles OAuth 2.0 token exchange for Supabase Auth.',
      'Proposed Solution':
        'We use the PKCE flow. The mobile client requests an auth code, ' +
        'exchanges it for access and refresh tokens via the Supabase auth endpoint.',
      'Data Model':
        '| Table | Field | Type | Notes |\n|---|---|---|---|\n| sessions | id | uuid | Primary key |',
    });
    const result = runQualityGate(sections, type);
    expect(result.passed).toBe(true);
  });

  it('warns on marketing language in a TDD', () => {
    const sections = makeSections({
      Overview: 'This will revolutionize how teams collaborate.',
      'Proposed Solution': 'We use REST APIs to sync data.',
    });
    const result = runQualityGate(sections, type);
    expect(result.issues.some((i) => i.code === 'MARKETING_LANGUAGE_IN_TDD')).toBe(true);
  });

  it('warns on unsafe privacy claims in a TDD', () => {
    const sections = makeSections({
      'Security & Privacy': 'The system is fully encrypted and secure by design.',
    });
    const result = runQualityGate(sections, type);
    expect(result.issues.some((i) => i.code === 'UNSAFE_PRIVACY_CLAIM')).toBe(true);
  });

  it('does not error on HTTP endpoint specs in a TDD (that is appropriate depth)', () => {
    const sections = makeSections({
      'API / Integrations':
        'POST /api/auth/token — exchanges code for access token. Returns HTTP 200 on success, HTTP 401 on invalid code.',
    });
    const result = runQualityGate(sections, type);
    // No INTERNAL_CONTENT or TDD_DETAIL errors for a TDD
    expect(result.issues.filter((i) => i.code === 'INTERNAL_CONTENT_IN_OVERVIEW')).toHaveLength(0);
    expect(result.issues.filter((i) => i.code === 'TDD_DETAIL_IN_OVERVIEW')).toHaveLength(0);
  });
});

// ─── runQualityGate — Feature Design ─────────────────────────────────────────

describe('runQualityGate — feature_design', () => {
  const type: DocumentTypeCategory = 'feature_design';

  it('passes with capability-level content', () => {
    const sections = makeSections({
      Overview: 'Caller Context Assistant shows who is calling before you answer.',
      'User Flow': 'User receives incoming call → app fetches context → card displayed.',
      'Business Logic': 'Context is fetched from the last 30 days of call history.',
    });
    const result = runQualityGate(sections, type);
    expect(result.passed).toBe(true);
  });

  it('errors when feature design contains internal setup content', () => {
    const sections = makeSections({
      Overview: 'This feature uses OPENAI_API_KEY to fetch context.',
    });
    const result = runQualityGate(sections, type);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'INTERNAL_CONTENT_IN_FEATURE_DESIGN')).toBe(true);
  });

  it('notes implementation detail as info (not error) in feature design', () => {
    const sections = makeSections({
      'Business Logic': 'Calls POST /api/context/fetch with caller_id. Returns HTTP 200.',
    });
    const result = runQualityGate(sections, type);
    expect(result.issues.some((i) => i.code === 'IMPLEMENTATION_DETAIL_IN_FEATURE_DESIGN')).toBe(true);
    expect(result.issues.find((i) => i.code === 'IMPLEMENTATION_DETAIL_IN_FEATURE_DESIGN')?.severity).toBe('info');
    // Info-only: gate still passes
    expect(result.passed).toBe(true);
  });
});

// ─── runQualityGate — summary and pass/fail logic ────────────────────────────

describe('runQualityGate — summary and pass/fail', () => {
  it('sets passed=true when only warnings or info exist', () => {
    const sections = makeSections({
      'Data Ownership': 'The platform is fully private.',
    });
    const result = runQualityGate(sections, 'system_overview');
    // UNSAFE_PRIVACY_CLAIM is a warning, not an error
    expect(result.issues.some((i) => i.severity === 'warning')).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('sets passed=false when at least one error exists', () => {
    const sections = makeSections({
      Overview: 'Run npm install to configure NOTION_TOKEN.',
    });
    const result = runQualityGate(sections, 'system_overview');
    expect(result.passed).toBe(false);
  });

  it('summary says "No issues" when gate is clean', () => {
    const sections = makeSections({
      'Product Vision': 'We help teams work faster.',
    });
    const result = runQualityGate(sections, 'system_overview');
    expect(result.summary).toContain('No issues');
  });

  it('includes documentType in result', () => {
    const result = runQualityGate([], 'tdd');
    expect(result.documentType).toBe('tdd');
  });
});
