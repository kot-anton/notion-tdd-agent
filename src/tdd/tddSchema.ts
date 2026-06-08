import { z } from 'zod';
import { notionPageIdSchema, notionPageRefSchema, confirmFlag } from '../utils/validation.js';

export const DocumentModeSchema = z.enum([
  'small_feature',
  'large_feature',
  'new_service',
  'api_change',
  'database_change',
  'infrastructure_change',
  'migration',
  'incident_followup',
]);
export type DocumentMode = z.infer<typeof DocumentModeSchema>;

export const TddStatusSchema = z.enum(['Draft', 'In Review', 'Approved', 'Deprecated']);
export type TddStatus = z.infer<typeof TddStatusSchema>;

export const TddSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.string(),
  required: z.boolean(),
});
export type TddSection = z.infer<typeof TddSectionSchema>;

export const TddDocumentSchema = z.object({
  title: z.string(),
  mode: DocumentModeSchema,
  status: TddStatusSchema.default('Draft'),
  owner: z.string(),
  reviewers: z.array(z.string()).default([]),
  sections: z.array(TddSectionSchema),
  notionPageId: z.string().optional(),
  notionUrl: z.string().optional(),
});
export type TddDocument = z.infer<typeof TddDocumentSchema>;

export const DiagramTypeSchema = z.enum([
  'flowchart',
  'sequence',
  'class',
  'entity_relationship',
  'state',
  'gantt',
  'component',
]);
export type DiagramType = z.infer<typeof DiagramTypeSchema>;

// ─── Tool Input Schemas ────────────────────────────────────────────────────────

export const TddCreateDocumentInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  mode: DocumentModeSchema,
  owner: z.string().min(1, 'Owner is required'),
  reviewers: z.array(z.string()).optional().default([]),
  context: z
    .string()
    .optional()
    .describe('Brief description of the change — used to pre-fill section stubs'),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview the document structure without writing to Notion'),
  parent_page_id: notionPageRefSchema
    .optional()
    .describe('Override NOTION_PARENT_PAGE_ID env var — accepts page ID or full Notion URL'),
});

export const TddUpdateDocumentInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL'),
  section_id: z
    .string()
    .describe('The section ID to update (e.g. "proposed_solution", "risks")'),
  content: z.string().min(1),
  confirm: confirmFlag.describe('Must be true to prevent accidental overwrites'),
});

export const TddAppendSectionInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL'),
  heading: z.string().min(1),
  content: z.string().min(1),
  level: z
    .enum(['heading_1', 'heading_2', 'heading_3'])
    .default('heading_2'),
});

export const TddGenerateOutlineInputSchema = z.object({
  title: z.string().min(1),
  mode: DocumentModeSchema,
  context: z.string().optional(),
});

export const TddValidateDocumentInputSchema = z
  .object({
    page_id: notionPageRefSchema
      .optional()
      .describe('Notion page ID or URL — load document from Notion'),
    document: TddDocumentSchema.optional().describe(
      'TddDocument object — validate in-memory document'
    ),
  })
  .refine((d) => d.page_id || d.document, {
    message: 'Provide either page_id or a document object',
  });

export const TddGenerateMermaidInputSchema = z.object({
  diagram_type: DiagramTypeSchema,
  description: z
    .string()
    .min(10, 'Provide at least 10 characters describing what to diagram'),
  title: z.string().optional(),
  save_locally: z.boolean().optional().default(true),
});

export const TddRenderDiagramInputSchema = z.object({
  mmd_content: z.string().min(1),
  output_format: z.enum(['svg', 'png']).default('svg'),
  filename_hint: z
    .string()
    .optional()
    .describe('Base filename for the output (no extension)'),
});

export const TddExportMarkdownInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL'),
  filename: z
    .string()
    .optional()
    .describe('Override filename (without extension)'),
});

export const NotionSearchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const NotionGetPageInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or full Notion URL'),
  include_blocks: z
    .boolean()
    .optional()
    .default(true)
    .describe('Fetch first-level blocks in addition to page metadata'),
});

export const NotionCreatePageInputSchema = z.object({
  title: z.string().min(1),
  blocks: z.array(z.unknown()).optional().default([]),
  parent_page_id: notionPageRefSchema
    .optional()
    .describe('Defaults to NOTION_PARENT_PAGE_ID env var — accepts page ID or full Notion URL'),
});

export const NotionUpdatePageInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL'),
  title: z.string().optional(),
  confirm: confirmFlag.describe('Must be true to prevent accidental updates'),
});

export const NotionAppendBlocksInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL'),
  blocks: z.array(z.unknown()),
});

export const TddGenerateImagePromptInputSchema = z.object({
  feature_description: z
    .string()
    .min(10)
    .describe('What the image should represent — feature, system, or concept'),
  visual_type: z
    .enum([
      'product_concept',
      'architecture_illustration',
      'app_mockup',
      'data_ownership',
      'ai_agent_workflow',
      'device_to_cloud',
      'roadmap_visual',
      'user_journey',
    ])
    .describe('Type of visual to generate'),
  style: z
    .enum(['minimal', 'technical', 'product', 'infographic'])
    .optional()
    .default('minimal')
    .describe('Visual style: minimal (clean lines), technical (engineering), product (UI-focused), infographic (data-driven)'),
});

export const TddAddMermaidToPageInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL'),
  diagram_type: DiagramTypeSchema,
  description: z
    .string()
    .min(10)
    .describe('Natural-language description of what to diagram'),
  title: z.string().optional().describe('Optional diagram section heading'),
  save_locally: z.boolean().optional().default(true),
});

export const TddReplaceSectionInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL'),
  section_title: z
    .string()
    .min(1)
    .describe(
      'Section heading to find (case-insensitive, partial match OK). ' +
      'Examples: "Data Model", "Proposed Solution", "Risks"'
    ),
  new_content_markdown: z
    .string()
    .min(1)
    .describe('New content to replace the section with (plain text or Markdown)'),
  mode: z
    .enum(['replace', 'append_if_not_found'])
    .default('replace')
    .describe(
      'replace: find the section, delete its old blocks, and re-insert the replacement at the ' +
      'original position using the Notion `after` parameter. Errors if the section is not found. ' +
      'append_if_not_found: same as replace when found; appends a new section at the end when not found (never errors).'
    ),
});

export const NotionGetCommentsInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL — returns all comment threads on this page'),
  block_id: z
    .string()
    .optional()
    .describe('Specific block ID to fetch inline comments for (overrides page_id)'),
});

export const NotionReplyCommentInputSchema = z.object({
  discussion_id: z.string().min(1).describe('Discussion thread ID to reply to'),
  text: z.string().min(1).describe('Reply text'),
});

export const NotionAddCommentInputSchema = z.object({
  page_id: notionPageRefSchema.describe('Notion page ID or URL — add a new top-level comment on this page'),
  text: z.string().min(1).describe('Comment text'),
});

// ─── System Overview Document Types ───────────────────────────────────────────

export const DocumentTypeSchema = z.enum(['tdd', 'system_overview']);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const SystemOverviewSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.string(),
  required: z.boolean(),
});
export type SystemOverviewSection = z.infer<typeof SystemOverviewSectionSchema>;

export const SystemOverviewDocumentSchema = z.object({
  title: z.string(),
  document_type: z.literal('system_overview'),
  status: TddStatusSchema.default('Draft'),
  owner: z.string(),
  sections: z.array(SystemOverviewSectionSchema),
  notionPageId: z.string().optional(),
  notionUrl: z.string().optional(),
});
export type SystemOverviewDocument = z.infer<typeof SystemOverviewDocumentSchema>;

export const SystemOverviewCreateInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  owner: z.string().min(1, 'Owner is required'),
  context: z
    .string()
    .optional()
    .describe('Brief description of the product or platform — used to pre-fill section stubs'),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview the document structure without writing to Notion'),
  parent_page_id: notionPageRefSchema
    .optional()
    .describe('Override NOTION_PARENT_PAGE_ID env var — accepts page ID or full Notion URL'),
});

export const SystemOverviewCreateChildTddsInputSchema = z.object({
  page_id: notionPageRefSchema.describe(
    'System Overview Notion page ID or URL — child TDDs will be created as sub-pages of this page'
  ),
  modules: z
    .array(z.string().min(1))
    .optional()
    .describe(
      'Module names to create TDDs for. If omitted, the agent parses the Core Modules section of the overview page.'
    ),
  owner: z.string().min(1, 'Owner for child TDDs'),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview the child TDDs that would be created without writing to Notion'),
  skip_existing: z
    .boolean()
    .optional()
    .default(true)
    .describe('Skip creation if a child page titled "TDD — [Module]" already exists under the overview'),
});
