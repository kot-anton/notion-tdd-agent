import type {
  BlockObjectRequest,
} from '@notionhq/client/build/src/api-endpoints.js';

export type NotionBlock = BlockObjectRequest;

// Minimal local type — Notion SDK does not re-export RichTextItemRequest
type RichTextItem = {
  type: 'text';
  text: { content: string };
  annotations?: Record<string, unknown>;
};

export interface TextAnnotations {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  color?: string;
}

export function richText(text: string, annotations?: TextAnnotations): RichTextItem[] {
  return [
    {
      type: 'text',
      text: { content: text },
      annotations: annotations as Record<string, unknown>,
    },
  ];
}

type RT = ReturnType<typeof richText>;

export function heading1Block(text: string): NotionBlock {
  return { type: 'heading_1', heading_1: { rich_text: richText(text) as RT } } as unknown as NotionBlock;
}

export function heading2Block(text: string): NotionBlock {
  return { type: 'heading_2', heading_2: { rich_text: richText(text) as RT } } as unknown as NotionBlock;
}

export function heading3Block(text: string): NotionBlock {
  return { type: 'heading_3', heading_3: { rich_text: richText(text) as RT } } as unknown as NotionBlock;
}

export function paragraphBlock(text: string, annotations?: TextAnnotations): NotionBlock {
  return {
    type: 'paragraph',
    paragraph: { rich_text: richText(text, annotations) as RT },
  } as unknown as NotionBlock;
}

export function bulletedListItem(text: string): NotionBlock {
  return {
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: richText(text) as RT },
  } as unknown as NotionBlock;
}

export function numberedListItem(text: string): NotionBlock {
  return {
    type: 'numbered_list_item',
    numbered_list_item: { rich_text: richText(text) as RT },
  } as unknown as NotionBlock;
}

export function todoBlock(text: string, checked = false): NotionBlock {
  return {
    type: 'to_do',
    to_do: { rich_text: richText(text) as RT, checked },
  } as unknown as NotionBlock;
}

export function quoteBlock(text: string): NotionBlock {
  return { type: 'quote', quote: { rich_text: richText(text) as RT } } as unknown as NotionBlock;
}

export function codeBlock(code: string, language = 'plain text'): NotionBlock {
  return {
    type: 'code',
    code: {
      rich_text: richText(code) as RT,
      language,
    },
  } as unknown as NotionBlock;
}

export function dividerBlock(): NotionBlock {
  return { type: 'divider', divider: {} } as unknown as NotionBlock;
}

export function calloutBlock(
  text: string,
  emoji = 'ℹ️',
  color = 'blue_background'
): NotionBlock {
  return {
    type: 'callout',
    callout: {
      rich_text: richText(text) as RT,
      icon: { type: 'emoji', emoji },
      color,
    },
  } as unknown as NotionBlock;
}

export function toggleBlock(heading: string, children: NotionBlock[]): NotionBlock {
  return {
    type: 'toggle',
    toggle: {
      rich_text: richText(heading, { bold: true }) as RT,
      children,
    },
  } as unknown as NotionBlock;
}

export function imageBlock(url: string, caption?: string): NotionBlock {
  return {
    type: 'image',
    image: {
      type: 'external',
      external: { url },
      ...(caption ? { caption: richText(caption) as RT } : {}),
    },
  } as unknown as NotionBlock;
}

export function tableBlock(headers: string[], rows: string[][]): NotionBlock {
  const headerRow = {
    type: 'table_row' as const,
    table_row: { cells: headers.map((h) => richText(h) as RT) },
  };
  const dataRows = rows.map((row) => ({
    type: 'table_row' as const,
    table_row: { cells: row.map((cell) => richText(cell) as RT) },
  }));

  return {
    type: 'table',
    table: {
      table_width: headers.length,
      has_column_header: true,
      has_row_header: false,
      children: [headerRow, ...dataRows],
    },
  } as unknown as NotionBlock;
}

export type TddStatus = 'Draft' | 'In Review' | 'Approved' | 'Deprecated';

export function statusCalloutBlock(status: TddStatus): NotionBlock {
  const config: Record<TddStatus, { emoji: string; color: string }> = {
    Draft: { emoji: '📝', color: 'gray_background' },
    'In Review': { emoji: '👀', color: 'yellow_background' },
    Approved: { emoji: '✅', color: 'green_background' },
    Deprecated: { emoji: '🚫', color: 'red_background' },
  };
  const { emoji, color } = config[status];
  return calloutBlock(`Status: ${status}`, emoji, color);
}

export function tableOfContentsBlocks(sectionHeadings: string[]): NotionBlock[] {
  return [
    heading2Block('Table of Contents'),
    ...sectionHeadings.map((h) => bulletedListItem(h)),
    dividerBlock(),
  ];
}

export function mermaidBlocks(
  mmdContent: string,
  renderedFilePath?: string
): NotionBlock[] {
  const blocks: NotionBlock[] = [codeBlock(mmdContent, 'mermaid')];
  if (renderedFilePath) {
    blocks.push(
      calloutBlock(
        `Rendered diagram saved locally: ${renderedFilePath}`,
        '📊',
        'blue_background'
      )
    );
  }
  return blocks;
}

export function tableOfContentsBlock(): NotionBlock {
  return { type: 'table_of_contents', table_of_contents: {} } as unknown as NotionBlock;
}

export function chunkBlocks(blocks: NotionBlock[], size = 100): NotionBlock[][] {
  const chunks: NotionBlock[][] = [];
  for (let i = 0; i < blocks.length; i += size) {
    chunks.push(blocks.slice(i, i + size));
  }
  return chunks;
}
