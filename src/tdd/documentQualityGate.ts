/**
 * Document Quality Gate
 *
 * Validates that document content matches the expected depth and audience
 * for the given document type before writing to Notion.
 *
 * Document type categories:
 *   system_overview  — High-level product overview; partner/investor-readable
 *   feature_design   — Mid-level capability design; product + light technical
 *   tdd              — Implementation design; full technical depth
 *   internal_readme  — Developer setup guide; commands, env vars, config
 *   unknown          — Cannot be determined
 *
 * The quality gate never blocks writes — it returns structured issues so the
 * agent can report and correct problems before or after publishing.
 */

export type DocumentTypeCategory =
  | 'system_overview'
  | 'feature_design'
  | 'tdd'
  | 'internal_readme'
  | 'unknown';

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  section?: string;
}

export interface QualityGateResult {
  passed: boolean;
  issues: QualityIssue[];
  summary: string;
  documentType: DocumentTypeCategory;
}

export interface SectionSnapshot {
  id?: string;
  heading: string;
  content: string;
}

// ─── Pattern Sets ─────────────────────────────────────────────────────────────

/**
 * Signals that content belongs in an internal README / developer setup doc.
 * These patterns must NOT appear in a product overview, feature design, or
 * partner-facing document.
 */
export const INTERNAL_SETUP_PATTERNS: RegExp[] = [
  // Common environment variable names
  /\b(NOTION_TOKEN|OPENAI_API_KEY|SUPABASE_URL|SUPABASE_KEY|NOTION_PARENT_PAGE_ID|DATABASE_URL|SECRET_KEY|API_SECRET)\b/,
  // npm / Node commands
  /\bnpm\s+(install|run|pack|publish|start|build|test)\b/i,
  /\bnpx\s+\S/i,
  /\bnode\s+dist\//i,
  /\btsx\s+watch\b/i,
  // MCP / Claude CLI setup
  /\bclaude\s+mcp\b/i,
  /\bmcp[\s-]add[\s-]json\b/i,
  /\bmcp-config\.example\b/i,
  // Docker
  /\bdocker(-compose)?\s+(up|build|run|pull)\b/i,
  // package.json structural patterns
  /"version":\s*"\d+\.\d+\.\d+"/,
  /"dependencies":\s*\{/,
  // Other package managers
  /\bbrew\s+install\b/i,
  /\bpip\s+install\b/i,
  /\byarn\s+(install|add)\b/i,
  // Shell scripts / CLI setup steps
  /\bexport\s+[A-Z_]+=["']/,
  /\bsource\s+\.env\b/i,
];

/**
 * Signals of deep implementation detail that belongs in a TDD, not in a
 * high-level System Overview intended for partners or stakeholders.
 */
export const TDD_IMPLEMENTATION_PATTERNS: RegExp[] = [
  // HTTP endpoint method + path
  /\b(GET|POST|PUT|PATCH|DELETE)\s+\/[a-zA-Z]/,
  // HTTP status codes in error/response tables
  /\bHTTP\s+[45]\d{2}\b/i,
  /\bstatus(?:_code)?:\s*[45]\d{2}\b/i,
  // Database DDL
  /\bCREATE\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  // Test code
  /\bdescribe\s*\(['"`]/,
  /\bit\s*\(['"`]/,
  /\bexpect\s*\(/,
  // Rollback plan specifics
  /\brollback\s+plan:/i,
];

/**
 * Absolute privacy or security claims that are risky without legal review.
 * Replace with cautious language: "designed to", "target model", "planned".
 */
export const UNSAFE_PRIVACY_PATTERNS: RegExp[] = [
  /\bnever\s+stores?\s+(user\s+)?data\b/i,
  /\bfully\s+private\b/i,
  /\bzero\s+access\b/i,
  /\bcompany\s+has\s+no\s+access\b/i,
  /\bdata\s+never\s+leaves\b/i,
  /\bdoes\s+not\s+accept\s+liability\b/i,
  /\bsecure\s+by\s+design\b/i,
  /\bproduction[\s-]?ready\b/i,
  /\bfully\s+encrypted\b/i,
  /\bno\s+data\s+is\s+stored\b/i,
];

/**
 * Marketing / investor-pitch language that does not belong in technical docs.
 */
export const MARKETING_LANGUAGE_PATTERNS: RegExp[] = [
  /\brevolutioniz\w*/i,               // revolutionize, revolutionizing
  /\bdisrupts?\b/i,                   // disrupt, disrupts
  /\b10x\s+(productivity|growth|revenue)\b/i,
  /\bmassive\s+market\s+opportunity\b/i,
  /\bgame[\s-]?changer\b/i,
  /\bworld[\s-]?class\s+solution\b/i,
];

/**
 * Signals that content contains image placeholder blocks rather than real visuals.
 * In a polished partner-facing System Overview, these should be replaced.
 */
export const IMAGE_PLACEHOLDER_PATTERNS: RegExp[] = [
  /📸\s*Image\s+Placeholder/i,
  /\[placeholder\]\s*[-–]/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// ─── Quality Gate ─────────────────────────────────────────────────────────────

/**
 * Runs the quality gate for a list of section snapshots against the expected
 * document type. Returns structured issues; never blocks document creation.
 *
 * Usage:
 *   const result = runQualityGate(doc.sections, 'system_overview');
 *   if (!result.passed) { // handle errors }
 */
export function runQualityGate(
  sections: SectionSnapshot[],
  documentType: DocumentTypeCategory
): QualityGateResult {
  const issues: QualityIssue[] = [];

  // Full text for cross-section pattern checks
  const fullText = sections.map((s) => `${s.heading}\n${s.content}`).join('\n\n');

  // ── Universal checks (all document types) ─────────────────────────────────

  if (matchesAny(fullText, UNSAFE_PRIVACY_PATTERNS)) {
    issues.push({
      severity: 'warning',
      code: 'UNSAFE_PRIVACY_CLAIM',
      message:
        'Document contains absolute privacy or security claims. ' +
        'Replace with cautious language: "designed to", "target model", "planned", or "intended to".',
    });
  }

  // ── System Overview ────────────────────────────────────────────────────────

  if (documentType === 'system_overview') {
    // Internal setup content is never appropriate in a product overview
    for (const section of sections) {
      const text = `${section.heading}\n${section.content}`;
      if (matchesAny(text, INTERNAL_SETUP_PATTERNS)) {
        issues.push({
          severity: 'error',
          code: 'INTERNAL_CONTENT_IN_OVERVIEW',
          section: section.heading,
          message:
            `Section "${section.heading}" contains internal setup content ` +
            `(environment variables, npm/CLI commands, MCP config, or package setup). ` +
            `This belongs in an internal README or developer setup document, ` +
            `not in a product overview.`,
        });
      }
    }

    // Deep implementation signals mean content should move to child TDDs
    if (matchesAny(fullText, TDD_IMPLEMENTATION_PATTERNS)) {
      issues.push({
        severity: 'warning',
        code: 'TDD_DETAIL_IN_OVERVIEW',
        message:
          'System Overview contains implementation-level content ' +
          '(HTTP endpoints, error codes, database DDL, or test code). ' +
          'Move this detail to a child TDD. Keep the overview at capability and module boundary level.',
      });
    }

    // Large placeholder callouts look unpolished in a partner-facing document
    if (matchesAny(fullText, IMAGE_PLACEHOLDER_PATTERNS)) {
      issues.push({
        severity: 'info',
        code: 'IMAGE_PLACEHOLDER_PRESENT',
        message:
          'Document contains image placeholder blocks. ' +
          'For a polished partner-facing overview, replace with a compact visual table ' +
          'or Mermaid diagrams. Real bitmap generation requires IMAGE_PROVIDER=openai with OPENAI_API_KEY.',
      });
    }
  }

  // ── Feature Design ────────────────────────────────────────────────────────

  if (documentType === 'feature_design') {
    if (matchesAny(fullText, INTERNAL_SETUP_PATTERNS)) {
      issues.push({
        severity: 'error',
        code: 'INTERNAL_CONTENT_IN_FEATURE_DESIGN',
        message:
          'Feature Design contains internal setup content (environment variables, npm commands, etc.). ' +
          'This belongs in an internal README or setup document.',
      });
    }

    if (matchesAny(fullText, TDD_IMPLEMENTATION_PATTERNS)) {
      issues.push({
        severity: 'info',
        code: 'IMPLEMENTATION_DETAIL_IN_FEATURE_DESIGN',
        message:
          'Feature Design contains implementation-level detail ' +
          '(API endpoints, HTTP error codes, database DDL). ' +
          'Consider creating a child TDD for implementation specifics. ' +
          'Feature Designs should describe capability behavior, not implementation contracts.',
      });
    }
  }

  // ── TDD ───────────────────────────────────────────────────────────────────

  if (documentType === 'tdd') {
    if (matchesAny(fullText, MARKETING_LANGUAGE_PATTERNS)) {
      issues.push({
        severity: 'warning',
        code: 'MARKETING_LANGUAGE_IN_TDD',
        message:
          'TDD contains marketing-style language. ' +
          'TDDs should be technical, specific, and implementation-focused.',
      });
    }

    // If TDD has multiple sections with content but no technical signals, flag it
    const substantiveSections = sections.filter(
      (s) =>
        s.content.trim().length > 100 &&
        !s.content.trimStart().startsWith('<!--')
    );
    if (
      substantiveSections.length >= 3 &&
      !matchesAny(fullText, TDD_IMPLEMENTATION_PATTERNS) &&
      !fullText.match(
        /\b(endpoint|schema|field|column|table|service|interface|function|class|method|param|payload|response|auth|migrate|deploy)\b/i
      )
    ) {
      issues.push({
        severity: 'info',
        code: 'TDD_MAY_LACK_TECHNICAL_DEPTH',
        message:
          'TDD sections contain content but show no clear technical implementation signals. ' +
          'Ensure the document includes architecture decisions, data models, API contracts, ' +
          'or service-level design.',
      });
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.length - errorCount - warnCount;
  const passed = errorCount === 0;

  let summary: string;
  if (issues.length === 0) {
    summary = 'Quality gate passed. No issues detected.';
  } else if (passed) {
    summary =
      `Quality gate passed with ${warnCount} warning(s)` +
      (infoCount > 0 ? ` and ${infoCount} info note(s)` : '') +
      '. Review warnings before publishing.';
  } else {
    summary =
      `Quality gate: ${errorCount} error(s), ${warnCount} warning(s), ${infoCount} info note(s). ` +
      'Fix errors before publishing.';
  }

  return { passed, issues, summary, documentType };
}

/**
 * Quickly classifies a single text blob for content type signals.
 * Useful for pre-screening a context field before document creation,
 * or for checking a single section's content in replaceSectionInPage.
 */
export function classifyContent(text: string): {
  hasInternalSetupContent: boolean;
  hasTddImplementationDetail: boolean;
  hasMarketingLanguage: boolean;
  hasUnsafePrivacyClaims: boolean;
  hasImagePlaceholders: boolean;
} {
  return {
    hasInternalSetupContent: matchesAny(text, INTERNAL_SETUP_PATTERNS),
    hasTddImplementationDetail: matchesAny(text, TDD_IMPLEMENTATION_PATTERNS),
    hasMarketingLanguage: matchesAny(text, MARKETING_LANGUAGE_PATTERNS),
    hasUnsafePrivacyClaims: matchesAny(text, UNSAFE_PRIVACY_PATTERNS),
    hasImagePlaceholders: matchesAny(text, IMAGE_PLACEHOLDER_PATTERNS),
  };
}
