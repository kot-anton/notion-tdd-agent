import { z } from 'zod';
import { notionPageIdSchema, confirmFlag } from '../utils/validation.js';

export const DesignTemplateTypeSchema = z.enum([
  'product_brief',
  'meeting_notes',
  'project_roadmap',
  'design_spec',
  'changelog',
  'onboarding_guide',
  'runbook',
]);
export type DesignTemplateType = z.infer<typeof DesignTemplateTypeSchema>;

export const DesignSectionTypeSchema = z.enum([
  'callout',
  'table',
  'toggle',
  'steps',
  'action_items',
]);
export type DesignSectionType = z.infer<typeof DesignSectionTypeSchema>;

export const PageDesignCreateInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  template: DesignTemplateTypeSchema.describe(
    'Visual document template to use. Choose from: product_brief, meeting_notes, project_roadmap, design_spec, changelog, onboarding_guide, runbook'
  ),
  owner: z.string().min(1, 'Owner is required'),
  context: z
    .string()
    .optional()
    .describe('Brief description — used to pre-fill the callout header'),
  icon_emoji: z
    .string()
    .optional()
    .describe('Override the template default emoji icon (e.g. "🚀")'),
  cover_url: z
    .string()
    .url()
    .optional()
    .describe('External image URL to use as the page cover'),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview the block structure without writing to Notion'),
  parent_page_id: notionPageIdSchema
    .optional()
    .describe('Override NOTION_PARENT_PAGE_ID env var'),
});

export const PageDesignPreviewInputSchema = z.object({
  template: DesignTemplateTypeSchema,
  title: z.string().optional().default('Untitled'),
});

export const PageDesignAddSectionInputSchema = z.object({
  page_id: notionPageIdSchema,
  section_type: DesignSectionTypeSchema.describe(
    'Type of styled section to append: callout, table, toggle, steps, action_items'
  ),
  heading: z.string().min(1),
  content: z
    .string()
    .min(1)
    .describe(
      'Section content. For table: "col1,col2|row1a,row1b|row2a,row2b". For steps/action_items: newline-separated items. For callout/toggle: free text.'
    ),
  icon: z.string().optional().default('📌').describe('Emoji icon for callout sections'),
  color: z
    .string()
    .optional()
    .default('gray_background')
    .describe('Background color for callout: gray_background, blue_background, green_background, yellow_background, red_background, purple_background'),
  confirm: confirmFlag.describe('Must be true to append to an existing page'),
});
