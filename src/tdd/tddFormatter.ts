import type { TddDocument, TddStatus, SystemOverviewDocument } from './tddSchema.js';
import {
  heading2Block,
  paragraphBlock,
  dividerBlock,
  statusCalloutBlock,
  calloutBlock,
  tableOfContentsBlocks,
  toggleBlock,
  tableBlock,
  type NotionBlock,
} from '../notion/notionBlocks.js';

const TOC_THRESHOLD = 8;

export interface FormattedTdd {
  titleText: string;
  blocks: NotionBlock[];
}

export function formatTddAsNotionBlocks(doc: TddDocument): FormattedTdd {
  const blocks: NotionBlock[] = [];

  // 1. Status badge at the top
  blocks.push(statusCalloutBlock(doc.status as TddStatus));

  // 2. Metadata table
  blocks.push(
    tableBlock(
      ['Field', 'Value'],
      [
        ['Owner', doc.owner],
        ['Reviewers', doc.reviewers.length ? doc.reviewers.join(', ') : '—'],
        ['Mode', doc.mode],
        ['Last Updated', new Date().toISOString().slice(0, 10)],
      ]
    )
  );

  blocks.push(dividerBlock());

  // 3. Table of contents for large documents
  if (doc.sections.length >= TOC_THRESHOLD) {
    blocks.push(...tableOfContentsBlocks(doc.sections.map((s) => s.heading)));
  }

  // 4. Sections
  for (const section of doc.sections) {
    blocks.push(heading2Block(section.heading));

    const content = section.content.trim() || section.heading;

    if (section.id === 'appendix') {
      // Appendix is collapsible
      blocks.push(toggleBlock(section.heading, [paragraphBlock(content)]));
    } else {
      blocks.push(paragraphBlock(content));
    }

    blocks.push(dividerBlock());
  }

  return { titleText: doc.title, blocks };
}

// ─── System Overview Formatter ────────────────────────────────────────────────

export function formatSystemOverviewAsNotionBlocks(doc: SystemOverviewDocument): FormattedTdd {
  const blocks: NotionBlock[] = [];

  // 1. Document type callout
  const statusConfig: Record<string, { emoji: string; color: string }> = {
    Draft: { emoji: '🏗️', color: 'blue_background' },
    'In Review': { emoji: '👀', color: 'yellow_background' },
    Approved: { emoji: '✅', color: 'green_background' },
    Deprecated: { emoji: '🚫', color: 'red_background' },
  };
  const { emoji, color } = statusConfig[doc.status] ?? statusConfig['Draft'];
  blocks.push(calloutBlock(`System Overview / Product Architecture Overview — ${doc.status}`, emoji, color));

  // 2. Metadata table
  blocks.push(
    tableBlock(
      ['Field', 'Value'],
      [
        ['Owner', doc.owner],
        ['Document Type', 'System Overview / Product Architecture Overview'],
        ['Last Updated', new Date().toISOString().slice(0, 10)],
      ]
    )
  );

  blocks.push(dividerBlock());

  // 3. Table of contents
  if (doc.sections.length >= TOC_THRESHOLD) {
    blocks.push(...tableOfContentsBlocks(doc.sections.map((s) => s.heading)));
  }

  // 4. Sections
  for (const section of doc.sections) {
    blocks.push(heading2Block(section.heading));

    const content = section.content.trim() || section.heading;

    if (section.id === 'appendix') {
      blocks.push(toggleBlock(section.heading, [paragraphBlock(content)]));
    } else {
      blocks.push(paragraphBlock(content));
    }

    blocks.push(dividerBlock());
  }

  return { titleText: doc.title, blocks };
}

export function formatSystemOverviewAsMarkdown(
  doc: SystemOverviewDocument,
  notionUrl?: string
): string {
  const lines: string[] = [];

  lines.push(`# ${doc.title}`);
  lines.push('');
  lines.push(`**Document Type:** System Overview / Product Architecture Overview`);
  lines.push(`**Status:** ${doc.status}`);
  lines.push(`**Owner:** ${doc.owner}`);
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  if (notionUrl) lines.push(`**Notion:** ${notionUrl}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`);
    lines.push('');
    lines.push(section.content.trim() || '<!-- TODO -->');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function formatTddAsMarkdown(
  doc: TddDocument,
  notionUrl?: string
): string {
  const lines: string[] = [];

  lines.push(`# ${doc.title}`);
  lines.push('');
  lines.push(`**Status:** ${doc.status}`);
  lines.push(`**Owner:** ${doc.owner}`);
  lines.push(`**Reviewers:** ${doc.reviewers.join(', ') || '—'}`);
  lines.push(`**Mode:** ${doc.mode}`);
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  if (notionUrl) lines.push(`**Notion:** ${notionUrl}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (doc.sections.length >= TOC_THRESHOLD) {
    lines.push('## Table of Contents');
    lines.push('');
    doc.sections.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.heading}](#${s.heading.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')})`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`);
    lines.push('');
    lines.push(section.content.trim() || '<!-- TODO -->');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
