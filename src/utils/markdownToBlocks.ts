import {
  paragraphBlock,
  bulletedListItem,
  numberedListItem,
  codeBlock,
  heading1Block,
  heading2Block,
  heading3Block,
  tableBlock,
  type NotionBlock,
} from '../notion/notionBlocks.js';

/**
 * Converts a Markdown string to an array of Notion block objects.
 * Supports: headings (h1–h3), fenced code blocks, bullet lists,
 * numbered lists, pipe tables, and paragraphs.
 */
export function markdownToBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split('\n');
  const blocks: NotionBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Fenced code block (``` or ~~~)
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const fence = trimmed.startsWith('```') ? '```' : '~~~';
      const langMatch = trimmed.slice(fence.length).trim();
      const lang = langMatch || 'plain text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push(codeBlock(codeLines.join('\n'), lang === 'plain text' ? 'plain text' : lang));
      continue;
    }

    // Headings
    const h3 = trimmed.match(/^### (.+)/);
    if (h3) { blocks.push(heading3Block(h3[1].trim())); i++; continue; }
    const h2 = trimmed.match(/^## (.+)/);
    if (h2) { blocks.push(heading2Block(h2[1].trim())); i++; continue; }
    const h1 = trimmed.match(/^# (.+)/);
    if (h1) { blocks.push(heading1Block(h1[1].trim())); i++; continue; }

    // Pipe table — collect all consecutive table lines
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const parsed = parseMarkdownTable(tableLines);
      if (parsed) blocks.push(tableBlock(parsed.headers, parsed.rows));
      continue;
    }

    // Bullet list item (- or * or +)
    const bullet = trimmed.match(/^[-*+] (.+)/);
    if (bullet) { blocks.push(bulletedListItem(bullet[1].trim())); i++; continue; }

    // Numbered list item (1. or 1)
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numbered) { blocks.push(numberedListItem(numbered[1].trim())); i++; continue; }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (t === '') break;
      if (t.startsWith('```') || t.startsWith('~~~')) break;
      if (t.match(/^#{1,3} /)) break;
      if (t.startsWith('|')) break;
      if (t.match(/^[-*+] /) || t.match(/^\d+[.)]\s/)) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(paragraphBlock(paraLines.join('\n')));
    }
  }

  return blocks;
}

function parseMarkdownTable(
  lines: string[]
): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 1) return null;

  const parseRow = (line: string): string[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

  const headers = parseRow(lines[0]);
  if (headers.length === 0) return null;

  // lines[1] is the separator (--- | --- |) — skip it
  const dataStart = lines.length > 1 && isSeparatorRow(lines[1]) ? 2 : 1;
  const rows = lines.slice(dataStart).map(parseRow);

  return { headers, rows };
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line.trim());
}
