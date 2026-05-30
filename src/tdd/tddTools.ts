import { getSectionsForMode } from './tddTemplate.js';
import { getSystemOverviewSections } from './systemOverviewTemplate.js';
import {
  runQualityGate,
  classifyContent,
  type QualityIssue,
  type QualityGateResult,
} from './documentQualityGate.js';
import {
  formatTddAsNotionBlocks,
  formatTddAsMarkdown,
  formatSystemOverviewAsNotionBlocks,
} from './tddFormatter.js';
import {
  searchNotionPages,
  getNotionPage,
  createNotionPage,
  appendBlocksToPage,
  listAllPageBlocks,
  deleteBlock,
  getBlockChildren,
  listChildPages,
} from '../notion/notionTools.js';
import type { NotionBlock_ } from '../notion/notionTools.js';
import { saveFile } from '../utils/fileStorage.js';
import { logger } from '../utils/logger.js';
import type {
  TddDocument,
  DocumentMode,
  TddStatus,
  SystemOverviewDocument,
} from './tddSchema.js';
import {
  heading2Block,
  heading3Block,
  heading1Block,
  dividerBlock,
  type NotionBlock,
} from '../notion/notionBlocks.js';
import { markdownToBlocks } from '../utils/markdownToBlocks.js';

// ─── tdd_create_document ──────────────────────────────────────────────────────

export interface CreateTddInput {
  title: string;
  mode: DocumentMode;
  owner: string;
  reviewers?: string[];
  context?: string;
  dry_run?: boolean;
  parent_page_id?: string;
}

export interface CreateTddResult {
  document: TddDocument;
  notionUrl?: string;
  notionPageId?: string;
  duplicateWarning?: string;
  quality_gate?: QualityGateResult;
  preview?: {
    titleText: string;
    blockCount: number;
    sectionCount: number;
    sections: string[];
  };
}

export async function createTddDocument(
  input: CreateTddInput
): Promise<CreateTddResult> {
  // 1. Duplicate detection
  let duplicateWarning: string | undefined;
  try {
    const existing = await searchNotionPages(input.title, 5);
    const dupe = existing.find(
      (p) => p.title.toLowerCase() === input.title.toLowerCase()
    );
    if (dupe) {
      duplicateWarning = `A page with this title already exists: "${dupe.title}" (${dupe.url}). ` +
        `Use tdd_update_document or tdd_append_section to modify it.`;
      logger.warn('Duplicate TDD detected', { title: input.title, url: dupe.url });
    }
  } catch {
    // Don't fail the whole operation if search fails
  }

  // 2. Build document from template
  const sectionDefs = getSectionsForMode(input.mode);
  const contextNote = input.context
    ? `\n\n> Context: ${input.context}`
    : '';

  const document: TddDocument = {
    title: input.title,
    mode: input.mode,
    status: 'Draft',
    owner: input.owner,
    reviewers: input.reviewers ?? [],
    sections: sectionDefs.map((s) => ({
      id: s.id,
      heading: s.heading,
      content: s.defaultContent + (s.id === 'summary' ? contextNote : ''),
      required: s.required,
    })),
  };

  // 3. Format to Notion blocks
  const { titleText, blocks } = formatTddAsNotionBlocks(document);

  // 4. Quality gate — scan section content (incl. context) for depth mismatches
  const quality_gate = runQualityGate(
    document.sections.map((s) => ({ id: s.id, heading: s.heading, content: s.content })),
    'tdd'
  );
  if (quality_gate.issues.length > 0) {
    logger.warn('TDD quality gate issues', { title: input.title, issues: quality_gate.issues });
  }

  // 5. Dry run — preview only
  if (input.dry_run) {
    return {
      document,
      duplicateWarning,
      quality_gate,
      preview: {
        titleText,
        blockCount: blocks.length,
        sectionCount: document.sections.length,
        sections: document.sections.map((s) => s.heading),
      },
    };
  }

  // 6. Publish to Notion
  const { id, url } = await createNotionPage(titleText, blocks, input.parent_page_id);
  document.notionPageId = id;
  document.notionUrl = url;

  return { document, notionUrl: url, notionPageId: id, duplicateWarning, quality_gate };
}

// ─── tdd_generate_outline ─────────────────────────────────────────────────────

export interface GenerateOutlineResult {
  title: string;
  mode: DocumentMode;
  sections: Array<{ id: string; heading: string; required: boolean; description: string }>;
}

export function generateTddOutline(
  title: string,
  mode: DocumentMode,
  _context?: string
): GenerateOutlineResult {
  const sections = getSectionsForMode(mode);
  return {
    title,
    mode,
    sections: sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      required: s.required,
      description: s.description,
    })),
  };
}

// ─── tdd_validate_document ────────────────────────────────────────────────────

export interface ValidationResult {
  score: number;
  grade: string;
  passed: string[];
  missing: string[];
  warnings: string[];
  checklist: Array<{
    id: string;
    heading: string;
    required: boolean;
    complete: boolean;
  }>;
  summary: string;
}

export function validateTddDocument(doc: TddDocument): ValidationResult {
  const passed: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const section of doc.sections) {
    const isEmpty =
      !section.content ||
      section.content.trimStart().startsWith('<!--') ||
      section.content.trim() === '';

    if (isEmpty) {
      if (section.required) {
        missing.push(section.id);
      } else {
        warnings.push(section.id);
      }
    } else {
      passed.push(section.id);
    }
  }

  const required = doc.sections.filter((s) => s.required);
  const score = required.length > 0
    ? Math.round((passed.filter((id) => required.some((r) => r.id === id)).length / required.length) * 100)
    : 100;

  const grade =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F';

  const checklist = doc.sections.map((s) => ({
    id: s.id,
    heading: s.heading,
    required: s.required,
    complete: passed.includes(s.id),
  }));

  const summary =
    missing.length === 0
      ? `Document is complete. Score: ${score}/100 (${grade})`
      : `Missing ${missing.length} required section(s): ${missing.join(', ')}. Score: ${score}/100 (${grade})`;

  return { score, grade, passed, missing, warnings, checklist, summary };
}

// ─── tdd_export_markdown ──────────────────────────────────────────────────────

export async function exportTddToMarkdown(
  pageId: string,
  filename?: string
): Promise<{ filePath: string; content: string }> {
  const page = await getNotionPage(pageId, false);

  // Build a minimal TddDocument from the page metadata
  const doc: TddDocument = {
    title: page.title,
    mode: 'large_feature',
    status: 'Draft',
    owner: '—',
    reviewers: [],
    sections: [],
    notionPageId: page.id,
    notionUrl: page.url,
  };

  const content = formatTddAsMarkdown(doc, page.url);
  const basename = filename ?? page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filePath = await saveFile(content, basename, 'md', 'exports');

  return { filePath, content };
}

// ─── tdd_append_section ───────────────────────────────────────────────────────

// ─── tdd_replace_section_in_page ──────────────────────────────────────────────

// Extracts plain text from a block's rich_text array.
function extractBlockText(block: NotionBlock_): string {
  const content = block.content as Record<string, unknown>;
  const blockData = content[block.type] as
    | { rich_text?: Array<{ plain_text?: string }> }
    | undefined;
  return blockData?.rich_text?.map((r) => r.plain_text ?? '').join('') ?? '';
}

// Returns 1/2/3 for heading levels, null for non-heading blocks.
function headingLevel(blockType: string): number | null {
  if (blockType === 'heading_1') return 1;
  if (blockType === 'heading_2') return 2;
  if (blockType === 'heading_3') return 3;
  return null;
}

export interface ReplaceSectionInput {
  page_id: string;
  section_title: string;
  new_content_markdown: string;
  mode: 'replace' | 'append_if_not_found';
}

export interface ReplaceSectionResult {
  found: boolean;
  deleted_count: number;
  appended: boolean;
  page_url: string;
  warning?: string;
  quality_warnings?: QualityIssue[];
  message: string;
}

export async function replaceSectionInPage(
  input: ReplaceSectionInput
): Promise<ReplaceSectionResult> {
  const { page_id, section_title, new_content_markdown, mode } = input;

  // Get page URL for the result
  const page = await getNotionPage(page_id, false);

  // Fetch every block on the page (paginated)
  const allBlocks = await listAllPageBlocks(page_id);

  // Find the target heading (case-insensitive, partial match in either direction)
  const needle = section_title.toLowerCase().trim();
  const targetIdx = allBlocks.findIndex((b) => {
    if (headingLevel(b.type) === null) return false;
    const text = extractBlockText(b).toLowerCase().trim();
    return text.includes(needle) || needle.includes(text);
  });

  // Pre-flight quality check on the incoming content
  const contentClassification = classifyContent(new_content_markdown);
  const quality_warnings: QualityIssue[] = [];
  if (contentClassification.hasInternalSetupContent) {
    quality_warnings.push({
      severity: 'warning',
      code: 'INTERNAL_CONTENT_IN_SECTION',
      section: section_title,
      message:
        `Section "${section_title}" contains internal setup content ` +
        `(environment variables, npm commands, or developer config). ` +
        `Verify this belongs in this document and not in an internal README.`,
    });
  }
  if (contentClassification.hasUnsafePrivacyClaims) {
    quality_warnings.push({
      severity: 'warning',
      code: 'UNSAFE_PRIVACY_CLAIM',
      section: section_title,
      message:
        `Section "${section_title}" contains absolute privacy or security claims. ` +
        `Use cautious language: "designed to", "target model", "planned", or "intended to".`,
    });
  }
  if (quality_warnings.length > 0) {
    logger.warn('Section quality warnings', { section: section_title, warnings: quality_warnings });
  }

  if (targetIdx === -1) {
    if (mode === 'append_if_not_found') {
      await appendSectionToPage({
        page_id,
        heading: section_title,
        content: new_content_markdown,
        level: 'heading_2',
      });
      return {
        found: false,
        deleted_count: 0,
        appended: true,
        page_url: page.url,
        quality_warnings: quality_warnings.length > 0 ? quality_warnings : undefined,
        message: `Section "${section_title}" not found — appended as new section at end of page.`,
      };
    }
    return {
      found: false,
      deleted_count: 0,
      appended: false,
      page_url: page.url,
      quality_warnings: quality_warnings.length > 0 ? quality_warnings : undefined,
      message:
        `Section "${section_title}" not found on this page. ` +
        `Check the heading name (e.g. "Data Model", "Proposed Solution") ` +
        `or use mode="append_if_not_found" to create it.`,
    };
  }

  const targetBlock = allBlocks[targetIdx];
  const targetLevel = headingLevel(targetBlock.type)!;
  const foundHeadingText = extractBlockText(targetBlock);

  // Record the block immediately before the target section.
  // After deletion we use its ID to re-insert the replacement at the same position.
  const predecessorBlock: NotionBlock_ | undefined = targetIdx > 0 ? allBlocks[targetIdx - 1] : undefined;

  // Collect all blocks belonging to this section (until the next same/higher-level heading)
  const sectionBlocks: NotionBlock_[] = [targetBlock];
  for (let i = targetIdx + 1; i < allBlocks.length; i++) {
    const b = allBlocks[i];
    const lvl = headingLevel(b.type);
    if (lvl !== null && lvl <= targetLevel) break; // next section starts here
    sectionBlocks.push(b);
  }

  // Delete every block in the old section (Notion archives them)
  for (const b of sectionBlocks) {
    await deleteBlock(b.id);
  }

  // Re-insert the replacement section at the original position using the `after` parameter.
  // If the section was the very first block (no predecessor), fall back to appending at the end.
  const headingFn =
    targetLevel === 1 ? heading1Block : targetLevel === 3 ? heading3Block : heading2Block;

  const contentBlocks = markdownToBlocks(new_content_markdown);
  const newBlocks: NotionBlock[] = [
    headingFn(foundHeadingText),
    ...contentBlocks,
    dividerBlock(),
  ];

  const positional = predecessorBlock !== undefined;
  await appendBlocksToPage(
    page_id,
    newBlocks,
    positional ? { afterBlockId: predecessorBlock!.id } : {}
  );

  const positionNote = positional
    ? `Inserted after block "${predecessorBlock!.id}" — section is in its original position.`
    : `Section was the first block on the page. Fallback: appended at end of page. Drag it to the top in Notion if needed.`;

  return {
    found: true,
    deleted_count: sectionBlocks.length,
    appended: true,
    page_url: page.url,
    ...(positional ? {} : { warning: positionNote }),
    quality_warnings: quality_warnings.length > 0 ? quality_warnings : undefined,
    message:
      `Section "${foundHeadingText}" replaced — deleted ${sectionBlocks.length} old block(s). ${positionNote}`,
  };
}

// ─── validateTddFromPage ──────────────────────────────────────────────────────

/**
 * Loads a Notion page's blocks, parses heading blocks to detect TDD sections,
 * collects their content, and validates the result with validateTddDocument.
 * Returns meaningful missing/warning results instead of an always-empty doc.
 */
export async function validateTddFromPage(pageId: string): Promise<ValidationResult> {
  const page = await getNotionPage(pageId, false);
  const allBlocks = await listAllPageBlocks(pageId);

  // Build a list of sections by walking heading blocks and collecting content beneath each.
  const sections: TddDocument['sections'] = [];
  let currentHeading: string | null = null;
  const contentLines: string[] = [];

  const flushSection = () => {
    if (currentHeading !== null) {
      sections.push({
        id: currentHeading.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
        heading: currentHeading,
        content: contentLines.join('\n').trim(),
        required: true,
      });
    }
    contentLines.length = 0;
  };

  for (const block of allBlocks) {
    if (['heading_1', 'heading_2', 'heading_3'].includes(block.type)) {
      flushSection();
      currentHeading = extractBlockText(block);
    } else {
      const text = extractBlockText(block);
      if (text) contentLines.push(text);
    }
  }
  flushSection();

  const doc: TddDocument = {
    title: page.title,
    mode: 'large_feature',
    status: 'Draft',
    owner: '—',
    reviewers: [],
    sections,
  };

  return validateTddDocument(doc);
}

// ─── detectDocumentType ───────────────────────────────────────────────────────

export type DetectedDocumentType =
  | 'system_overview'
  | 'feature_design'
  | 'tdd'
  | 'internal_readme'
  | 'unknown';

const SYSTEM_OVERVIEW_KEYWORDS = [
  'system overview',
  'product overview',
  'product architecture overview',
  'high-level overview',
  'high level overview',
  'platform overview',
  'what we are building',
  'project overview',
  'parent document',
  'product architecture',
  'architecture overview',
];

// Feature Design: capability-focused, product + light technical, NOT full implementation
const FEATURE_DESIGN_KEYWORDS = [
  'feature design',
  'capability design',
  'capability overview',
  'workflow design',
  'integration design',
  'product capability',
  'design the feature',
  'design the capability',
  'business logic for',
  'user flow for',
];

const TDD_KEYWORDS = [
  'tdd',
  'technical design document',
  'technical design',
  'implementation design',
  'design doc for feature',
  'design doc for module',
  'how to implement',
  'module design',
  'service design',
  'design doc',
];

// Internal README / setup guide: developer-facing, commands, env vars, config
const INTERNAL_README_KEYWORDS = [
  'readme',
  'setup guide',
  'setup doc',
  'installation guide',
  'developer guide',
  'getting started guide',
  'onboarding guide',
  'environment setup',
  'env setup',
  'how to install',
  'how to set up',
  'how to configure',
];

/**
 * Detects the intended document type from user input.
 * Returns one of: system_overview | feature_design | tdd | internal_readme | unknown.
 *
 * Detection order ensures higher-priority types win when keywords overlap:
 *   1. system_overview  (product-level overview)
 *   2. feature_design   (capability-level design, not full implementation)
 *   3. tdd              (full technical implementation design)
 *   4. internal_readme  (developer setup / configuration guide)
 */
export function detectDocumentType(input: string): DetectedDocumentType {
  const lower = input.toLowerCase();
  for (const keyword of SYSTEM_OVERVIEW_KEYWORDS) {
    if (lower.includes(keyword)) return 'system_overview';
  }
  for (const keyword of FEATURE_DESIGN_KEYWORDS) {
    if (lower.includes(keyword)) return 'feature_design';
  }
  for (const keyword of TDD_KEYWORDS) {
    if (lower.includes(keyword)) return 'tdd';
  }
  for (const keyword of INTERNAL_README_KEYWORDS) {
    if (lower.includes(keyword)) return 'internal_readme';
  }
  return 'unknown';
}

// ─── system_overview_create_document ─────────────────────────────────────────

export interface CreateSystemOverviewInput {
  title: string;
  owner: string;
  context?: string;
  dry_run?: boolean;
  parent_page_id?: string;
}

export interface CreateSystemOverviewResult {
  document: SystemOverviewDocument;
  notionUrl?: string;
  notionPageId?: string;
  duplicateWarning?: string;
  quality_gate?: QualityGateResult;
  preview?: {
    titleText: string;
    blockCount: number;
    sectionCount: number;
    sections: string[];
  };
}

export async function createSystemOverviewDocument(
  input: CreateSystemOverviewInput
): Promise<CreateSystemOverviewResult> {
  // 1. Duplicate check
  let duplicateWarning: string | undefined;
  try {
    const existing = await searchNotionPages(input.title, 5);
    const dupe = existing.find(
      (p) => p.title.toLowerCase() === input.title.toLowerCase()
    );
    if (dupe) {
      duplicateWarning =
        `A page with this title already exists: "${dupe.title}" (${dupe.url}). ` +
        `Use tdd_replace_section_in_page or tdd_append_section to modify it.`;
      logger.warn('Duplicate System Overview detected', { title: input.title, url: dupe.url });
    }
  } catch {
    // Don't fail if search fails
  }

  // 2. Build document from template
  const sectionDefs = getSystemOverviewSections();
  const contextNote = input.context ? `\n\n> Context: ${input.context}` : '';

  const document: SystemOverviewDocument = {
    title: input.title,
    document_type: 'system_overview',
    status: 'Draft',
    owner: input.owner,
    sections: sectionDefs.map((s) => ({
      id: s.id,
      heading: s.heading,
      content: s.defaultContent + (s.id === 'product_vision' ? contextNote : ''),
      required: s.required,
    })),
  };

  // 3. Format to Notion blocks
  const { titleText, blocks } = formatSystemOverviewAsNotionBlocks(document);

  // 4. Quality gate — scan section content for depth mismatches
  const quality_gate = runQualityGate(
    document.sections.map((s) => ({ id: s.id, heading: s.heading, content: s.content })),
    'system_overview'
  );
  if (quality_gate.issues.length > 0) {
    logger.warn('System Overview quality gate issues', { title: input.title, issues: quality_gate.issues });
  }

  // 5. Dry run — preview only
  if (input.dry_run) {
    return {
      document,
      duplicateWarning,
      quality_gate,
      preview: {
        titleText,
        blockCount: blocks.length,
        sectionCount: document.sections.length,
        sections: document.sections.map((s) => s.heading),
      },
    };
  }

  // 6. Publish to Notion
  const { id, url } = await createNotionPage(titleText, blocks, input.parent_page_id);
  document.notionPageId = id;
  document.notionUrl = url;

  return { document, notionUrl: url, notionPageId: id, duplicateWarning, quality_gate };
}

// ─── validateSystemOverviewDocument ──────────────────────────────────────────

export function validateSystemOverviewDocument(
  doc: SystemOverviewDocument
): ValidationResult {
  const passed: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const section of doc.sections) {
    const isEmpty =
      !section.content ||
      section.content.trimStart().startsWith('<!--') ||
      section.content.trim() === '';

    if (isEmpty) {
      if (section.required) missing.push(section.id);
      else warnings.push(section.id);
    } else {
      passed.push(section.id);
    }
  }

  const required = doc.sections.filter((s) => s.required);
  const score =
    required.length > 0
      ? Math.round(
          (passed.filter((id) => required.some((r) => r.id === id)).length /
            required.length) *
            100
        )
      : 100;

  const grade =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F';

  const checklist = doc.sections.map((s) => ({
    id: s.id,
    heading: s.heading,
    required: s.required,
    complete: passed.includes(s.id),
  }));

  const summary =
    missing.length === 0
      ? `System Overview is complete. Score: ${score}/100 (${grade})`
      : `Missing ${missing.length} required section(s): ${missing.join(', ')}. Score: ${score}/100 (${grade})`;

  return { score, grade, passed, missing, warnings, checklist, summary };
}

// ─── system_overview_create_child_tdds ────────────────────────────────────────

export interface CreateChildTddsInput {
  page_id: string;
  modules?: string[];
  owner: string;
  dry_run?: boolean;
  skip_existing?: boolean;
}

export interface ChildTddCreated {
  title: string;
  module: string;
  notionUrl: string;
  notionPageId: string;
}

export interface ChildTddSkipped {
  title: string;
  module: string;
  reason: string;
}

export interface CreateChildTddsResult {
  created: ChildTddCreated[];
  skipped: ChildTddSkipped[];
  dry_run: boolean;
  overview_url: string;
  summary: string;
}

/**
 * Extracts module names from a Notion table block's rows.
 * Returns the first-column text of each non-header data row.
 */
async function extractModulesFromTableBlock(tableBlockId: string): Promise<string[]> {
  const rows = await getBlockChildren(tableBlockId);
  const modules: string[] = [];
  let isFirstRow = true;
  for (const row of rows) {
    if (row.type !== 'table_row') continue;
    if (isFirstRow) { isFirstRow = false; continue; } // skip header
    const content = row.content as Record<string, unknown>;
    const tableRow = content.table_row as { cells?: Array<Array<{ plain_text?: string }>> } | undefined;
    const firstCell = tableRow?.cells?.[0];
    if (firstCell) {
      const text = firstCell.map((r) => r.plain_text ?? '').join('').trim();
      if (text && text !== '...' && !text.startsWith('Module')) {
        modules.push(text);
      }
    }
  }
  return modules;
}

/**
 * Parses the Core Modules section of a System Overview page to extract module names.
 * Finds the heading, then looks for a table block in the section, reads its rows.
 */
async function parseModulesFromOverviewPage(pageId: string): Promise<string[]> {
  const allBlocks = await listAllPageBlocks(pageId);

  // Find "Core Modules" heading
  const coreModulesIdx = allBlocks.findIndex((b) => {
    if (!['heading_1', 'heading_2', 'heading_3'].includes(b.type)) return false;
    const text = extractBlockText(b).toLowerCase();
    return text.includes('core modules') || text.includes('modules');
  });

  if (coreModulesIdx === -1) return [];

  const headingBlock = allBlocks[coreModulesIdx];
  const headingLvl = headingLevel(headingBlock.type)!;

  // Collect blocks in this section (until next same/higher heading)
  const sectionBlocks: NotionBlock_[] = [];
  for (let i = coreModulesIdx + 1; i < allBlocks.length; i++) {
    const b = allBlocks[i];
    const lvl = headingLevel(b.type);
    if (lvl !== null && lvl <= headingLvl) break;
    sectionBlocks.push(b);
  }

  // Find a table block in the section
  const tableBlock = sectionBlocks.find((b) => b.type === 'table');
  if (tableBlock) {
    return extractModulesFromTableBlock(tableBlock.id);
  }

  // Fall back: look for paragraph text with pipe-table pattern
  for (const b of sectionBlocks) {
    if (b.type !== 'paragraph') continue;
    const text = extractBlockText(b);
    // Parse lines that look like "| Module Name | ..."
    const lines = text.split('\n');
    const modules: string[] = [];
    let pastHeader = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) continue;
      if (/^[|\s:-]+$/.test(trimmed)) { pastHeader = true; continue; }
      if (!pastHeader && trimmed.toLowerCase().includes('module')) { pastHeader = true; continue; }
      if (pastHeader) {
        const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
        const name = cells[0];
        if (name && name !== '...' && name.length > 1) modules.push(name);
      }
    }
    if (modules.length > 0) return modules;
  }

  return [];
}

export async function createChildTddsFromOverview(
  input: CreateChildTddsInput
): Promise<CreateChildTddsResult> {
  const { page_id, owner, dry_run = false, skip_existing = true } = input;

  // 1. Load overview page
  const overviewPage = await getNotionPage(page_id, false);

  // 2. Resolve module list
  let moduleNames = input.modules ?? [];
  if (moduleNames.length === 0) {
    moduleNames = await parseModulesFromOverviewPage(page_id);
  }
  if (moduleNames.length === 0) {
    throw new Error(
      'No modules found. Provide a "modules" list or make sure the System Overview page ' +
      'has a "Core Modules" section with a table listing module names in the first column.'
    );
  }

  // 3. Load existing child pages to detect duplicates
  let existingChildTitles: Set<string> = new Set();
  if (skip_existing) {
    try {
      const children = await listChildPages(page_id);
      existingChildTitles = new Set(children.map((c) => c.title.toLowerCase()));
    } catch {
      // If we can't list children, proceed without skip logic
    }
  }

  const created: ChildTddCreated[] = [];
  const skipped: ChildTddSkipped[] = [];

  for (const moduleName of moduleNames) {
    const childTitle = moduleName.startsWith('TDD —') || moduleName.startsWith('TDD - ')
      ? moduleName
      : `TDD — ${moduleName}`;

    if (skip_existing && existingChildTitles.has(childTitle.toLowerCase())) {
      skipped.push({
        title: childTitle,
        module: moduleName,
        reason: 'Child TDD page already exists under the System Overview.',
      });
      continue;
    }

    if (dry_run) {
      created.push({
        title: childTitle,
        module: moduleName,
        notionUrl: '[dry_run — not created]',
        notionPageId: '[dry_run]',
      });
      continue;
    }

    // Create TDD as child of the overview page
    const { document, notionUrl, notionPageId } = await createTddDocument({
      title: childTitle,
      mode: 'large_feature',
      owner,
      context: `Child TDD for module: ${moduleName}. Parent: ${overviewPage.title}`,
      parent_page_id: page_id,
    });

    if (notionUrl && notionPageId) {
      created.push({ title: childTitle, module: moduleName, notionUrl, notionPageId });
      logger.info('Child TDD created', { title: childTitle, notionUrl });
    }
    void document; // suppress unused warning
  }

  // 4. If any TDDs were created, update the Child TDDs section of the overview
  if (!dry_run && created.length > 0) {
    const tableRows = created
      .map((c) => `| ${c.title} | ${c.module} | Draft | [Open](${c.notionUrl}) |`)
      .join('\n');

    const newChildTddsContent =
      `| TDD Document | Module / Feature | Status | Notes |\n` +
      `|---|---|---|---|\n` +
      tableRows;

    try {
      await replaceSectionInPage({
        page_id,
        section_title: 'Child Technical Design Documents',
        new_content_markdown: newChildTddsContent,
        mode: 'append_if_not_found',
      });
      logger.info('Child TDDs section updated in System Overview', { count: created.length });
    } catch {
      // Don't fail the whole operation if section update fails
    }
  }

  const summary = dry_run
    ? `Dry run: would create ${created.length} child TDD(s), skip ${skipped.length}.`
    : `Created ${created.length} child TDD(s), skipped ${skipped.length}.`;

  return {
    created,
    skipped,
    dry_run,
    overview_url: overviewPage.url,
    summary,
  };
}

// ─── tdd_append_section ───────────────────────────────────────────────────────

export async function appendSectionToPage(input: {
  page_id: string;
  heading: string;
  content: string;
  level: 'heading_1' | 'heading_2' | 'heading_3';
}): Promise<{ appendedCount: number }> {
  const headingBlock: NotionBlock =
    input.level === 'heading_1'
      ? heading1Block(input.heading)
      : input.level === 'heading_3'
      ? heading3Block(input.heading)
      : heading2Block(input.heading);

  const contentBlocks = markdownToBlocks(input.content);

  const blocks: NotionBlock[] = [
    headingBlock,
    ...contentBlocks,
    dividerBlock(),
  ];

  return appendBlocksToPage(input.page_id, blocks);
}
