import { z } from 'zod';

export const notionPageIdSchema = z
  .string()
  .regex(
    /^[a-f0-9]{32}$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    'Must be a valid Notion page ID (32-char hex or UUID format)'
  );

// Accepts a 32-char hex ID, UUID, or any Notion URL (notion.so / notion.com / app.notion.com).
export const notionPageRefSchema = z
  .string()
  .min(1)
  .refine(
    (val) => {
      if (val.includes('notion.so') || val.includes('notion.com')) return true;
      if (/^[a-f0-9]{32}$/i.test(val)) return true;
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(val)) return true;
      return false;
    },
    { message: 'Must be a Notion page ID (32-char hex, UUID) or a full Notion URL' }
  );

export const nonEmptyString = z.string().min(1, 'Cannot be empty');

export const confirmFlag = z.boolean().optional().default(false);

export function normalizeNotionId(id: string): string {
  return id.replace(/-/g, '');
}

/**
 * Extracts a normalized 32-char Notion page ID from a URL.
 * Returns null when the input is not a Notion URL or no ID can be found.
 *
 * Supports:
 *   https://app.notion.com/p/Title-32hexchars
 *   https://www.notion.so/workspace/Title-32hexchars
 *   https://notion.so/32hexchars
 *   URL with UUID segment: .../Title-8hex-4hex-4hex-4hex-12hex
 */
export function parseNotionPageUrl(input: string): string | null {
  if (!input.includes('notion.so') && !input.includes('notion.com')) return null;
  // UUID with dashes (e.g. 36e89748-16b8-8169-93ed-c0400edc28ae)
  const uuidMatch = input.match(
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:[/?#].*)?$/i
  );
  if (uuidMatch) return uuidMatch[1].replace(/-/g, '');
  // 32-char hex at the end of the URL path (most common format)
  const hexMatch = input.match(/([a-f0-9]{32})(?:[/?#].*)?$/i);
  if (hexMatch) return hexMatch[1];
  return null;
}

/**
 * Resolves any Notion page reference to a normalized 32-char page ID.
 * Accepts: full Notion URL, 32-char hex, or UUID format.
 */
export function resolveNotionPageId(input: string): string {
  const fromUrl = parseNotionPageUrl(input);
  if (fromUrl) return fromUrl;
  return normalizeNotionId(input);
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');
}
