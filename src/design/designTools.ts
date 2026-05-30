import {
  getDesignTemplate,
  listDesignTemplates,
  DESIGN_TEMPLATES,
} from './designTemplates.js';
import { createDesignPage, searchNotionPages, appendBlocksToPage } from '../notion/notionTools.js';
import {
  heading2Block,
  heading3Block,
  paragraphBlock,
  bulletedListItem,
  numberedListItem,
  todoBlock,
  calloutBlock,
  toggleBlock,
  tableBlock,
  dividerBlock,
  type NotionBlock,
} from '../notion/notionBlocks.js';
import { logger } from '../utils/logger.js';
import { normalizeNotionId } from '../utils/validation.js';
import type { DesignTemplateType, DesignSectionType } from './designSchema.js';

// ─── page_design_create ───────────────────────────────────────────────────────

export interface CreateDesignPageInput {
  title: string;
  template: DesignTemplateType;
  owner: string;
  context?: string;
  icon_emoji?: string;
  cover_url?: string;
  dry_run?: boolean;
  parent_page_id?: string;
}

export interface CreateDesignPageResult {
  template: string;
  title: string;
  icon: string;
  blockCount: number;
  sections: string[];
  notionUrl?: string;
  notionPageId?: string;
  duplicateWarning?: string;
  preview?: {
    blocks: string[];
  };
}

export async function createDesignPageDocument(
  input: CreateDesignPageInput
): Promise<CreateDesignPageResult> {
  const tmpl = getDesignTemplate(input.template);
  const icon = input.icon_emoji ?? tmpl.icon;

  // Duplicate detection
  let duplicateWarning: string | undefined;
  try {
    const existing = await searchNotionPages(input.title, 5);
    const dupe = existing.find(
      (p) => p.title.toLowerCase() === input.title.toLowerCase()
    );
    if (dupe) {
      duplicateWarning =
        `A page named "${dupe.title}" already exists: ${dupe.url}. ` +
        `Use page_design_add_section to extend it instead.`;
      logger.warn('Duplicate design page detected', { title: input.title, url: dupe.url });
    }
  } catch {
    // search failure must not block creation
  }

  const blocks = tmpl.buildBlocks({
    title: input.title,
    owner: input.owner,
    context: input.context,
  });

  const sectionHeadings = blocks
    .filter((b: NotionBlock) => {
      const block = b as Record<string, unknown>;
      return block.type === 'heading_2';
    })
    .map((b: NotionBlock) => {
      const block = b as Record<string, unknown>;
      const h2 = block.heading_2 as Record<string, unknown> | undefined;
      const richTextArr = h2?.rich_text as Array<{ text?: { content?: string } }> | undefined;
      return richTextArr?.[0]?.text?.content ?? '';
    })
    .filter(Boolean);

  if (input.dry_run) {
    return {
      template: tmpl.name,
      title: input.title,
      icon,
      blockCount: blocks.length,
      sections: sectionHeadings,
      duplicateWarning,
      preview: {
        blocks: blocks.map((b: NotionBlock) => {
          const block = b as Record<string, unknown>;
          return String(block.type);
        }),
      },
    };
  }

  const { id, url } = await createDesignPage(input.title, blocks, {
    iconEmoji: icon,
    coverUrl: input.cover_url,
    parentPageId: input.parent_page_id,
  });

  return {
    template: tmpl.name,
    title: input.title,
    icon,
    blockCount: blocks.length,
    sections: sectionHeadings,
    notionUrl: url,
    notionPageId: id,
    duplicateWarning,
  };
}

// ─── page_design_preview ──────────────────────────────────────────────────────

export interface PreviewDesignTemplateResult {
  template: string;
  icon: string;
  description: string;
  sections: string[];
  blockCount: number;
  allTemplates: Array<{ type: string; name: string; icon: string; description: string }>;
}

export function previewDesignTemplate(
  templateType: DesignTemplateType,
  title: string
): PreviewDesignTemplateResult {
  const tmpl = getDesignTemplate(templateType);
  const blocks = tmpl.buildBlocks({ title, owner: 'Preview', context: undefined });

  const sections = blocks
    .filter((b: NotionBlock) => {
      const block = b as Record<string, unknown>;
      return block.type === 'heading_2';
    })
    .map((b: NotionBlock) => {
      const block = b as Record<string, unknown>;
      const h2 = block.heading_2 as Record<string, unknown> | undefined;
      const richTextArr = h2?.rich_text as Array<{ text?: { content?: string } }> | undefined;
      return richTextArr?.[0]?.text?.content ?? '';
    })
    .filter(Boolean);

  return {
    template: tmpl.name,
    icon: tmpl.icon,
    description: tmpl.description,
    sections,
    blockCount: blocks.length,
    allTemplates: listDesignTemplates(),
  };
}

// ─── page_design_add_section ─────────────────────────────────────────────────

export interface AddDesignSectionInput {
  page_id: string;
  section_type: DesignSectionType;
  heading: string;
  content: string;
  icon?: string;
  color?: string;
}

export async function addDesignSection(
  input: AddDesignSectionInput
): Promise<{ appendedCount: number; message: string }> {
  const blocks: NotionBlock[] = [heading2Block(input.heading), dividerBlock()];

  switch (input.section_type) {
    case 'callout': {
      blocks.push(
        calloutBlock(input.content, input.icon ?? '📌', input.color ?? 'gray_background')
      );
      break;
    }

    case 'table': {
      // Format: "col1,col2|row1a,row1b|row2a,row2b"
      const [headerLine, ...rowLines] = input.content.split('|');
      const headers = (headerLine ?? '').split(',').map((h) => h.trim());
      const rows = rowLines.map((r) => r.split(',').map((c) => c.trim()));
      if (headers.length > 0 && rows.length > 0) {
        blocks.push(tableBlock(headers, rows));
      } else {
        blocks.push(
          paragraphBlock('(Table data was empty — use format: "col1,col2|row1a,row1b")')
        );
      }
      break;
    }

    case 'toggle': {
      blocks.push(
        toggleBlock(input.heading, [paragraphBlock(input.content)])
      );
      break;
    }

    case 'steps': {
      const steps = input.content.split('\n').filter(Boolean);
      steps.forEach((step) => blocks.push(numberedListItem(step)));
      break;
    }

    case 'action_items': {
      const items = input.content.split('\n').filter(Boolean);
      items.forEach((item) => blocks.push(todoBlock(item)));
      break;
    }
  }

  const result = await appendBlocksToPage(normalizeNotionId(input.page_id), blocks);
  return {
    appendedCount: result.appendedCount,
    message: `"${input.heading}" section (${input.section_type}) appended — ${result.appendedCount} blocks added.`,
  };
}
