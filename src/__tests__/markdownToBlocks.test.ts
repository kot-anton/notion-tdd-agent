import { describe, it, expect } from 'vitest';
import { markdownToBlocks } from '../utils/markdownToBlocks.js';

describe('markdownToBlocks', () => {
  it('converts a paragraph to a paragraph block', () => {
    const blocks = markdownToBlocks('Hello world');
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as Record<string, unknown>).type).toBe('paragraph');
  });

  it('converts h1 to heading_1', () => {
    const blocks = markdownToBlocks('# Title');
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as Record<string, unknown>).type).toBe('heading_1');
  });

  it('converts h2 to heading_2', () => {
    const blocks = markdownToBlocks('## Section');
    expect((blocks[0] as Record<string, unknown>).type).toBe('heading_2');
  });

  it('converts h3 to heading_3', () => {
    const blocks = markdownToBlocks('### Sub');
    expect((blocks[0] as Record<string, unknown>).type).toBe('heading_3');
  });

  it('converts - bullet items', () => {
    const blocks = markdownToBlocks('- Item A\n- Item B');
    expect(blocks).toHaveLength(2);
    expect((blocks[0] as Record<string, unknown>).type).toBe('bulleted_list_item');
    expect((blocks[1] as Record<string, unknown>).type).toBe('bulleted_list_item');
  });

  it('converts * bullet items', () => {
    const blocks = markdownToBlocks('* Item A');
    expect((blocks[0] as Record<string, unknown>).type).toBe('bulleted_list_item');
  });

  it('converts numbered list items', () => {
    const blocks = markdownToBlocks('1. First\n2. Second');
    expect(blocks).toHaveLength(2);
    expect((blocks[0] as Record<string, unknown>).type).toBe('numbered_list_item');
  });

  it('converts fenced code block', () => {
    const blocks = markdownToBlocks('```typescript\nconst x = 1;\n```');
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as Record<string, unknown>).type).toBe('code');
  });

  it('uses mermaid language for mermaid code blocks', () => {
    const blocks = markdownToBlocks('```mermaid\ngraph LR\n  A-->B\n```');
    expect(blocks).toHaveLength(1);
    const code = blocks[0] as Record<string, unknown>;
    expect(code.type).toBe('code');
    const codeContent = code.code as Record<string, unknown>;
    expect(codeContent.language).toBe('mermaid');
  });

  it('converts pipe table to table block', () => {
    const md = '| Name | Age |\n|---|---|\n| Alice | 30 |\n| Bob | 25 |';
    const blocks = markdownToBlocks(md);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as Record<string, unknown>).type).toBe('table');
  });

  it('skips blank lines without producing blocks', () => {
    const blocks = markdownToBlocks('\n\n\n');
    expect(blocks).toHaveLength(0);
  });

  it('handles mixed content', () => {
    const md = [
      '## Overview',
      '',
      'Some paragraph text.',
      '',
      '- Bullet one',
      '- Bullet two',
      '',
      '```json',
      '{"key": "value"}',
      '```',
    ].join('\n');
    const blocks = markdownToBlocks(md);
    const types = blocks.map((b) => (b as Record<string, unknown>).type);
    expect(types).toContain('heading_2');
    expect(types).toContain('paragraph');
    expect(types).toContain('bulleted_list_item');
    expect(types).toContain('code');
  });
});
