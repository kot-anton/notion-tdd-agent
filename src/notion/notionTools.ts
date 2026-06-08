import { APIResponseError } from '@notionhq/client';
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints.js';
import { getNotionClient } from './notionClient.js';
import { chunkBlocks, type NotionBlock } from './notionBlocks.js';
import { logger } from '../utils/logger.js';
import { normalizeNotionId, resolveNotionPageId } from '../utils/validation.js';

export { parseNotionPageUrl, resolveNotionPageId } from '../utils/validation.js';

export interface NotionSearchResult {
  id: string;
  title: string;
  url: string;
  lastEdited: string;
}

export interface NotionBlock_ {
  id: string;
  type: string;
  content: unknown;
}

export interface NotionPageResult {
  id: string;
  title: string;
  url: string;
  blocks: NotionBlock_[];
}

function extractTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, unknown> | undefined;
  if (!props) return 'Untitled';
  for (const val of Object.values(props)) {
    const p = val as Record<string, unknown>;
    if (p.type === 'title' && Array.isArray(p.title) && p.title.length > 0) {
      const texts = p.title as Array<{ plain_text?: string }>;
      return texts.map((t) => t.plain_text ?? '').join('');
    }
  }
  return 'Untitled';
}

function notionErrorMessage(err: unknown): string {
  if (err instanceof APIResponseError) {
    if (err.status === 401)
      return 'Authentication failed. Check your NOTION_TOKEN.';
    if (err.status === 403)
      return 'Access denied. Make sure the Notion integration has access to this page.';
    if (err.status === 404)
      return 'Page not found. Check the page ID and that the integration has been added to the page.';
    if (err.status === 400)
      return `Bad request: ${err.message}`;
    return `Notion API error (${err.status}): ${err.message}`;
  }
  return String(err);
}

export async function searchNotionPages(
  query: string,
  limit = 20
): Promise<NotionSearchResult[]> {
  const notion = getNotionClient();
  const results: NotionSearchResult[] = [];
  let cursor: string | undefined;

  try {
    while (results.length < limit) {
      const res = await notion.search({
        query,
        filter: { property: 'object', value: 'page' },
        page_size: Math.min(limit - results.length, 100),
        ...(cursor ? { start_cursor: cursor } : {}),
      });

      for (const obj of res.results) {
        const page = obj as Record<string, unknown>;
        results.push({
          id: page.id as string,
          title: extractTitle(page),
          url: (page.url as string) ?? '',
          lastEdited: (page.last_edited_time as string) ?? '',
        });
      }

      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }

  return results;
}

export async function getNotionPage(
  pageId: string,
  includeBlocks = true
): Promise<NotionPageResult> {
  const notion = getNotionClient();
  const id = resolveNotionPageId(pageId);

  try {
    const page = (await notion.pages.retrieve({ page_id: id })) as Record<string, unknown>;
    const title = extractTitle(page);
    const url = (page.url as string) ?? '';

    let blocks: NotionBlock_[] = [];
    if (includeBlocks) {
      const res = await notion.blocks.children.list({ block_id: id, page_size: 100 });
      blocks = res.results.map((b) => {
        const block = b as Record<string, unknown>;
        return { id: block.id as string, type: block.type as string, content: block };
      });
    }

    return { id, title, url, blocks };
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

export async function createDesignPage(
  title: string,
  blocks: NotionBlock[],
  options: {
    iconEmoji?: string;
    coverUrl?: string;
    parentPageId?: string;
  } = {}
): Promise<{ id: string; url: string }> {
  const notion = getNotionClient();
  const parentId = options.parentPageId ?? process.env.NOTION_PARENT_PAGE_ID;

  if (!parentId) {
    throw new Error(
      'No parent page ID provided. Set NOTION_PARENT_PAGE_ID in .env or pass parent_page_id.'
    );
  }

  const chunks = chunkBlocks(blocks);
  logger.info('Creating design page', { title, blockCount: blocks.length });

  const pagePayload: Record<string, unknown> = {
    parent: { type: 'page_id', page_id: resolveNotionPageId(parentId) },
    properties: {
      title: { type: 'title', title: [{ type: 'text', text: { content: title } }] },
    },
    children: (chunks[0] ?? []) as BlockObjectRequest[],
  };

  if (options.iconEmoji) {
    pagePayload.icon = { type: 'emoji', emoji: options.iconEmoji };
  }
  if (options.coverUrl) {
    pagePayload.cover = { type: 'external', external: { url: options.coverUrl } };
  }

  try {
    const page = (await notion.pages.create(
      pagePayload as Parameters<typeof notion.pages.create>[0]
    )) as Record<string, unknown>;

    const pageId = page.id as string;
    const url = (page.url as string) ?? '';

    for (let i = 1; i < chunks.length; i++) {
      await appendBlocksToPage(pageId, chunks[i]);
    }

    logger.info('Design page created', { pageId, url });
    return { id: pageId, url };
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

export async function createNotionPage(
  title: string,
  blocks: NotionBlock[],
  parentPageId?: string
): Promise<{ id: string; url: string }> {
  const notion = getNotionClient();
  const parentId = parentPageId ?? process.env.NOTION_PARENT_PAGE_ID;

  if (!parentId) {
    throw new Error(
      'No parent page ID provided. Set NOTION_PARENT_PAGE_ID in .env or pass parent_page_id.'
    );
  }

  const chunks = chunkBlocks(blocks);
  logger.info('Creating Notion page', { title, blockCount: blocks.length, chunks: chunks.length });

  try {
    const firstChunk = chunks[0] ?? [];
    const page = (await notion.pages.create({
      parent: { type: 'page_id', page_id: resolveNotionPageId(parentId) },
      properties: {
        title: {
          type: 'title',
          title: [{ type: 'text', text: { content: title } }],
        },
      },
      children: firstChunk as BlockObjectRequest[],
    })) as Record<string, unknown>;

    const pageId = page.id as string;
    const url = (page.url as string) ?? '';

    // Append remaining chunks if the TDD is large
    for (let i = 1; i < chunks.length; i++) {
      await appendBlocksToPage(pageId, chunks[i]);
    }

    logger.info('Notion page created', { pageId, url });
    return { id: pageId, url };
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

export async function updateNotionPageTitle(
  pageId: string,
  title: string
): Promise<void> {
  const notion = getNotionClient();
  const id = resolveNotionPageId(pageId);

  try {
    await notion.pages.update({
      page_id: id,
      properties: {
        title: {
          type: 'title',
          title: [{ type: 'text', text: { content: title } }],
        },
      },
    });
    logger.info('Notion page title updated', { pageId: id });
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

export async function appendBlocksToPage(
  pageId: string,
  blocks: NotionBlock[],
  options: {
    // Insert after this block ID (Notion `after` parameter).
    // For multi-chunk payloads, each chunk is inserted after the last block of the previous chunk,
    // preserving ordering even when the replacement is larger than 100 blocks.
    afterBlockId?: string;
  } = {}
): Promise<{ appendedCount: number }> {
  const notion = getNotionClient();
  const id = resolveNotionPageId(pageId);
  const chunks = chunkBlocks(blocks);
  let appendedCount = 0;
  // Tracks the ID of the last inserted block so each subsequent chunk inserts after it.
  // Only used when afterBlockId was supplied (positional insertion); plain appends don't need it.
  let currentAfter: string | undefined = options.afterBlockId;

  try {
    for (const chunk of chunks) {
      const response = await notion.blocks.children.append({
        block_id: id,
        children: chunk as BlockObjectRequest[],
        ...(currentAfter ? { after: currentAfter } : {}),
      });
      appendedCount += chunk.length;

      // When doing positional insertion, capture the last appended block so the next
      // chunk inserts after it instead of drifting to the end of the page.
      if (options.afterBlockId !== undefined) {
        const results = (response as Record<string, unknown>).results as
          | Array<Record<string, unknown>>
          | undefined;
        const lastId = results?.at(-1)?.id as string | undefined;
        if (lastId) currentAfter = lastId;
      }
    }
    logger.info('Blocks appended', { pageId: id, appendedCount, afterBlockId: options.afterBlockId });
    return { appendedCount };
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

// Fetches ALL blocks from a page, paginating through cursors (no 100-block limit).
export async function listAllPageBlocks(pageId: string): Promise<NotionBlock_[]> {
  const notion = getNotionClient();
  const id = resolveNotionPageId(pageId);
  const blocks: NotionBlock_[] = [];
  let cursor: string | undefined;

  try {
    while (true) {
      const res = await notion.blocks.children.list({
        block_id: id,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });

      for (const b of res.results) {
        const block = b as Record<string, unknown>;
        blocks.push({ id: block.id as string, type: block.type as string, content: block });
      }

      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }

    logger.info('Listed all page blocks', { pageId: id, count: blocks.length });
    return blocks;
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

/**
 * Returns the first-level children of a specific block.
 * Useful for reading table rows (children of a table block) and other nested content.
 */
export async function getBlockChildren(blockId: string): Promise<NotionBlock_[]> {
  const notion = getNotionClient();
  const blocks: NotionBlock_[] = [];
  let cursor: string | undefined;

  try {
    while (true) {
      const res = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });

      for (const b of res.results) {
        const block = b as Record<string, unknown>;
        blocks.push({ id: block.id as string, type: block.type as string, content: block });
      }

      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }

    return blocks;
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

// Archives (deletes) a single block by ID. Notion calls this "delete" but it archives the block.
export async function deleteBlock(blockId: string): Promise<void> {
  const notion = getNotionClient();
  try {
    await notion.blocks.delete({ block_id: blockId });
    logger.info('Block archived', { blockId });
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

/**
 * Lists all direct child pages of a parent page.
 * Returns child_page blocks — does not recurse into sub-pages.
 * Requires the integration to have access to each child page separately.
 */
export async function listChildPages(parentId: string): Promise<NotionSearchResult[]> {
  const notion = getNotionClient();
  const id = resolveNotionPageId(parentId);
  const results: NotionSearchResult[] = [];
  let cursor: string | undefined;

  try {
    while (true) {
      const res = await notion.blocks.children.list({
        block_id: id,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });

      for (const block of res.results) {
        const b = block as Record<string, unknown>;
        if (b.type === 'child_page') {
          const childPage = b.child_page as Record<string, unknown> | undefined;
          const childId = (b.id as string).replace(/-/g, '');
          results.push({
            id: childId,
            title: (childPage?.title as string) ?? 'Untitled',
            url: `https://www.notion.so/${childId}`,
            lastEdited: (b.last_edited_time as string) ?? '',
          });
        }
      }

      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }

    logger.info('Listed child pages', { parentId: id, count: results.length });
    return results;
  } catch (err) {
    const msg = notionErrorMessage(err);
    if (msg.includes('403') || msg.includes('Access denied')) {
      throw new Error(
        `Access denied to page "${id}". Make sure the Notion integration has been added to this page ` +
        `(page → Connections → toggle on your integration). ` +
        `Note: the integration must be added to both the parent page AND each child page or database.`
      );
    }
    if (msg.includes('404') || msg.includes('not found')) {
      throw new Error(
        `Page "${id}" not found. Possible causes:\n` +
        `  • The page has not been shared with the integration\n` +
        `  • The page ID is incorrect\n` +
        `  • The integration may see the parent but not its children — share each child page with the integration`
      );
    }
    throw new Error(msg);
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface NotionComment {
  id: string;
  discussion_id: string;
  author: string;
  created_at: string;
  text: string;
}

export interface NotionCommentThread {
  discussion_id: string;
  block_id: string;
  comments: NotionComment[];
}

export async function getPageComments(
  blockOrPageId: string
): Promise<NotionCommentThread[]> {
  const notion = getNotionClient();
  const id = resolveNotionPageId(blockOrPageId);
  const allComments: NotionComment[] = [];
  let cursor: string | undefined;

  try {
    while (true) {
      const res = await notion.comments.list({
        block_id: id,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });

      for (const c of res.results) {
        const raw = c as Record<string, unknown>;
        const richText = (raw.rich_text as Array<{ plain_text?: string }>) ?? [];
        const text = richText.map((r) => r.plain_text ?? '').join('');
        const createdBy = raw.created_by as Record<string, unknown> | undefined;
        const author = (createdBy?.name as string) ?? 'Unknown';

        allComments.push({
          id: raw.id as string,
          discussion_id: raw.discussion_id as string,
          author,
          created_at: raw.created_time as string,
          text,
        });
      }

      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }

    // Group by discussion_id to produce threads
    const threadsMap = new Map<string, NotionCommentThread>();
    for (const comment of allComments) {
      if (!threadsMap.has(comment.discussion_id)) {
        threadsMap.set(comment.discussion_id, {
          discussion_id: comment.discussion_id,
          block_id: id,
          comments: [],
        });
      }
      threadsMap.get(comment.discussion_id)!.comments.push(comment);
    }

    logger.info('Fetched page comments', { blockId: id, threads: threadsMap.size });
    return Array.from(threadsMap.values());
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

export async function createNotionComment(params: {
  discussion_id?: string;
  block_id?: string;
  text: string;
}): Promise<{ id: string; discussion_id: string }> {
  const notion = getNotionClient();
  const richText = [{ type: 'text' as const, text: { content: params.text } }];

  try {
    let result: Record<string, unknown>;
    if (params.discussion_id) {
      result = (await notion.comments.create({
        discussion_id: params.discussion_id,
        rich_text: richText,
      })) as Record<string, unknown>;
    } else if (params.block_id) {
      const id = resolveNotionPageId(params.block_id);
      result = (await notion.comments.create({
        parent: { page_id: id },
        rich_text: richText,
      })) as Record<string, unknown>;
    } else {
      throw new Error('Provide either discussion_id (to reply) or block_id/page_id (for a new thread)');
    }

    logger.info('Comment created', { id: result.id, discussionId: result.discussion_id });
    return { id: result.id as string, discussion_id: result.discussion_id as string };
  } catch (err) {
    throw new Error(notionErrorMessage(err));
  }
}

/**
 * Searches child pages of a parent by title (case-insensitive, partial match).
 * Tries exact match first, then partial. Returns null if nothing found.
 */
export async function findChildPageByTitle(
  parentId: string,
  titleQuery: string
): Promise<NotionSearchResult | null> {
  const children = await listChildPages(parentId);
  if (children.length === 0) return null;
  const q = titleQuery.toLowerCase().trim();
  const exact = children.find((p) => p.title.toLowerCase() === q);
  if (exact) return exact;
  const partial = children.find((p) => p.title.toLowerCase().includes(q));
  return partial ?? null;
}

/**
 * Resolves a page reference (URL, ID, or title) to a NotionPageResult.
 * Priority: URL → raw ID → workspace search → child page search.
 *
 * If `parentId` is provided and the direct lookup fails, falls back to searching
 * child pages of that parent by title.
 */
export async function resolveAndGetPage(
  input: string,
  options: { includeBlocks?: boolean; parentId?: string } = {}
): Promise<NotionPageResult & { resolvedFrom?: string }> {
  const { includeBlocks = true, parentId } = options;

  // 1. URL → extract ID and load directly
  if (input.includes('notion.so') || input.includes('notion.com')) {
    const id = resolveNotionPageId(input);
    try {
      const page = await getNotionPage(id, includeBlocks);
      return { ...page, resolvedFrom: 'url' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found') || msg.includes('404')) {
        throw new Error(
          `Page not found via URL. The page may not be shared with the integration.\n` +
          `  • Open the Notion page → Connections → toggle on your integration\n` +
          `  • Page ID extracted from URL: ${id}`
        );
      }
      throw err;
    }
  }

  // 2. Looks like a raw page ID — load directly
  if (/^[a-f0-9]{32}$/i.test(input) || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input)) {
    const page = await getNotionPage(input, includeBlocks);
    return { ...page, resolvedFrom: 'id' };
  }

  // 3. Title search — try workspace search first
  const searchResults = await searchNotionPages(input, 5);
  const match = searchResults.find(
    (r) => r.title.toLowerCase().includes(input.toLowerCase())
  );
  if (match) {
    const page = await getNotionPage(match.id, includeBlocks);
    return { ...page, resolvedFrom: 'search' };
  }

  // 4. Child page search within parent
  if (parentId) {
    const child = await findChildPageByTitle(parentId, input);
    if (child) {
      const page = await getNotionPage(child.id, includeBlocks);
      return { ...page, resolvedFrom: 'child_search' };
    }
  }

  throw new Error(
    `Could not find a Notion page matching "${input}".\n` +
    `Tried: workspace search, ${parentId ? 'child page search, ' : ''}direct ID lookup.\n` +
    `Tips:\n` +
    `  • Provide the full Notion page URL instead of a title\n` +
    `  • Make sure the page is shared with the integration\n` +
    `  • Try searching by a unique word from the page title`
  );
}
