import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ZodError } from 'zod';
import { logger } from './utils/logger.js';
import { formatZodError } from './utils/validation.js';
import {
  checkAuthStatus,
  saveCredentials,
  buildSetupGuide,
} from './utils/credentialManager.js';

// Schemas
import {
  TddCreateDocumentInputSchema,
  TddUpdateDocumentInputSchema,
  TddAppendSectionInputSchema,
  TddGenerateOutlineInputSchema,
  TddValidateDocumentInputSchema,
  TddGenerateMermaidInputSchema,
  TddRenderDiagramInputSchema,
  TddExportMarkdownInputSchema,
  TddGenerateImagePromptInputSchema,
  TddAddMermaidToPageInputSchema,
  TddReplaceSectionInputSchema,
  NotionSearchInputSchema,
  NotionGetPageInputSchema,
  NotionCreatePageInputSchema,
  NotionUpdatePageInputSchema,
  NotionAppendBlocksInputSchema,
  NotionGetCommentsInputSchema,
  NotionReplyCommentInputSchema,
  NotionAddCommentInputSchema,
  SystemOverviewCreateInputSchema,
  SystemOverviewCreateChildTddsInputSchema,
} from './tdd/tddSchema.js';

// Notion tools
import {
  searchNotionPages,
  getNotionPage,
  createNotionPage,
  updateNotionPageTitle,
  appendBlocksToPage,
  getPageComments,
  createNotionComment,
} from './notion/notionTools.js';

// TDD tools
import {
  createTddDocument,
  generateTddOutline,
  validateTddDocument,
  validateTddFromPage,
  exportTddToMarkdown,
  appendSectionToPage,
  replaceSectionInPage,
  createSystemOverviewDocument,
  createChildTddsFromOverview,
  validateSystemOverviewDocument,
  detectDocumentType,
} from './tdd/tddTools.js';

// Renderers
import {
  generateMermaidSyntax,
  renderMermaid,
} from './renderers/mermaidRenderer.js';
import { saveFile } from './utils/fileStorage.js';

// Design tools
import {
  PageDesignCreateInputSchema,
  PageDesignPreviewInputSchema,
  PageDesignAddSectionInputSchema,
} from './design/designSchema.js';
import {
  createDesignPageDocument,
  previewDesignTemplate,
  addDesignSection,
} from './design/designTools.js';
import { listDesignTemplates } from './design/designTemplates.js';

// Visual generation
import { getVisualConfig } from './design/imageProvider.js';
import { generateBitmapImage } from './design/visualProviderFactory.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

function handleError(e: unknown): ReturnType<typeof err> {
  if (e instanceof ZodError) {
    return err(`Validation error:\n${formatZodError(e)}`);
  }
  return err(e instanceof Error ? e.message : String(e));
}

type ToolResult = ReturnType<typeof ok>;
type ToolHandler = (input: unknown) => Promise<ToolResult>;

function buildImagePlaceholder(visualDesc: string, prompt: string, _provider?: string): string {
  // NOTE: Do not include provider-specific setup instructions (API keys, env vars) here.
  // Provider configuration belongs in the internal README / setup document, not in
  // product overviews or TDDs. The visual_generation field in notion_check_auth
  // already explains the current provider status to the agent.
  return [
    `Visual: ${visualDesc}`,
    ``,
    `Description: ${prompt}`,
    ``,
    `This is a placeholder. Add a Mermaid diagram (tdd_add_mermaid_to_page) or configure`,
    `image generation to insert a real visual here.`,
    ``,
    `Suggested placement: Architecture section or Appendix.`,
  ].join('\n');
}

// Prepends a human-readable attribution header to a Notion comment.
// Reads NOTION_AGENT_USER from env (e.g. "Anton Ishchenko").
// Format: "Anton Ishchenko (via Notion Agent)\n\n[text]"
function withAttribution(text: string): string {
  const userName = process.env.NOTION_AGENT_USER?.trim();
  const header = userName ? `${userName} (via Notion Agent)` : 'via Notion Agent';
  return `${header}\n\n${text}`;
}

// Every Notion-touching tool is wrapped with this.
// If credentials are missing it returns the setup guide instead of failing.
function withAuth(handler: ToolHandler): ToolHandler {
  return async (input) => {
    const status = checkAuthStatus();
    if (!status.ok) {
      return ok({ setup_required: true, guide: buildSetupGuide(status) });
    }
    return handler(input);
  };
}

// ─── Server ───────────────────────────────────────────────────────────────────

async function main() {
  const server = new McpServer({
    name: 'notion-tdd-agent',
    version: '1.0.0',
  });

  // ── Auth Tools ───────────────────────────────────────────────────────────

  server.tool(
    'notion_check_auth',
    [
      'Checks whether Notion credentials (NOTION_TOKEN and NOTION_PARENT_PAGE_ID) are configured.',
      'If anything is missing, returns a full step-by-step setup guide.',
      'Always call this first when the user asks to create a Notion document.',
    ].join(' '),
    {},
    async () => {
      const status = checkAuthStatus();
      const visual = getVisualConfig();
      if (status.ok) {
        return ok({
          authenticated: true,
          message:
            'Notion credentials are configured. Ready to create System Overviews and Technical Design Documents.',
          visual_generation: {
            enabled: visual.enabled,
            provider_preference: visual.providerPreference,
            detected_provider: visual.detectedProvider,
            quality_mode: visual.qualityMode,
            bitmap_available: visual.bitmapAvailable,
            can_generate: visual.canGenerate,
            warning: visual.warningMessage,
            // Legacy alias kept for backward compatibility
            provider: visual.detectedProvider,
          },
        });
      }
      return ok({ authenticated: false, setup_required: true, guide: buildSetupGuide(status) });
    }
  );

  server.tool(
    'notion_save_credentials',
    [
      'Saves your Notion credentials to the local .env file.',
      'Provide token (starts with secret_ or ntn_) and/or page_id.',
      'Credentials are stored locally — never sent anywhere except the Notion API.',
      'After saving, the server uses the new values immediately without restart.',
    ].join(' '),
    {
      token: z
        .string()
        .optional()
        .describe('Notion Access Token (starts with secret_ or ntn_)'),
      page_id: z
        .string()
        .optional()
        .describe('Notion parent page ID — 32-char hex or UUID from the page URL'),
    },
    async (input) => {
      try {
        const { token, page_id } = input as { token?: string; page_id?: string };
        if (!token && !page_id) {
          return err('Provide at least one of: token or page_id.');
        }
        const result = await saveCredentials({ token, page_id });
        const status = checkAuthStatus();
        return ok({
          saved: result.saved,
          authenticated: status.ok,
          next: status.ok
            ? 'Both credentials are set. You can now create TDDs in Notion. Call notion_verify_connection to confirm.'
            : `Still missing: ${status.missing.join(', ')}. ${buildSetupGuide(status)}`,
        });
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    'notion_verify_connection',
    [
      'Tests the Notion connection by making a real API call.',
      'Call this after notion_save_credentials to confirm everything works.',
      'Returns a success message on success, or a specific error with fix suggestions.',
    ].join(' '),
    {},
    async () => {
      const status = checkAuthStatus();
      if (!status.ok) {
        return ok({ verified: false, setup_required: true, guide: buildSetupGuide(status) });
      }
      try {
        const results = await searchNotionPages('', 1);
        return ok({
          verified: true,
          message: 'Notion connection is working. Your TDD agent is ready.',
          hint: results.length > 0
            ? `Found accessible pages. Ready to go.`
            : 'Connection works. Make sure you have shared the parent page with your connection (page … → Connections → toggle on).',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return ok({
          verified: false,
          error: msg,
          tip: msg.includes('401') || msg.includes('Authentication')
            ? 'Your NOTION_TOKEN looks invalid. Re-copy it from app.notion.com/developers/connections and call notion_save_credentials again.'
            : msg.includes('404') || msg.includes('not found')
            ? 'NOTION_PARENT_PAGE_ID not found. Check that you shared the page with your connection (page … → Connections).'
            : 'Check your .env values and try again.',
        });
      }
    }
  );

  // ── TDD Tools ────────────────────────────────────────────────────────────

  server.tool(
    'tdd_create_document',
    [
      'Creates a Technical Design Document and publishes it as a Notion page.',
      'Searches for duplicates first. Supports dry_run: true to preview without writing.',
      'Returns the created document structure, Notion URL, and page ID.',
    ].join(' '),
    TddCreateDocumentInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = TddCreateDocumentInputSchema.parse(input);
        const result = await createTddDocument(validated);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'tdd_update_document',
    [
      'Appends an update note to an existing TDD Notion page (non-destructive).',
      'Creates a new "Updated: <section_id>" heading block followed by the provided content.',
      'Does NOT replace the existing section — use tdd_replace_section_in_page for in-place replacement.',
      'Requires confirm: true. Provide page_id and section_id (e.g. "proposed_solution", "risks").',
    ].join(' '),
    TddUpdateDocumentInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = TddUpdateDocumentInputSchema.parse(input);
        if (!validated.confirm) {
          return err('confirm: true is required to update a document.');
        }
        const result = await appendSectionToPage({
          page_id: validated.page_id,
          heading: `Updated: ${validated.section_id}`,
          content: validated.content,
          level: 'heading_2',
        });
        return ok({
          message: `Section "${validated.section_id}" updated (appended as new blocks).`,
          appendedCount: result.appendedCount,
        });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'tdd_append_section',
    [
      'Appends a new section (heading + content) to the end of an existing Notion page.',
      'Safe — never overwrites existing content.',
    ].join(' '),
    TddAppendSectionInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = TddAppendSectionInputSchema.parse(input);
        const result = await appendSectionToPage({
          page_id: validated.page_id,
          heading: validated.heading,
          content: validated.content,
          level: validated.level,
        });
        return ok({ message: 'Section appended successfully.', ...result });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'tdd_replace_section_in_page',
    [
      'Replaces a specific section of an existing TDD Notion page with new content.',
      'Reads ALL page blocks, locates the target heading (case-insensitive partial match),',
      'deletes the old heading + all its content blocks, then re-inserts the replacement',
      'at the original position using the Notion `after` parameter anchored to the predecessor block.',
      'mode="replace": find + replace in place (errors if section not found).',
      'mode="append_if_not_found": replace if found, otherwise append a new section at the end.',
      'Edge case: if the section is the very first block (no predecessor), falls back to',
      'end-of-page append and returns a warning field. Drag the section to the top in Notion if needed.',
    ].join(' '),
    TddReplaceSectionInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = TddReplaceSectionInputSchema.parse(input);
        const result = await replaceSectionInPage(validated);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'tdd_generate_outline',
    [
      'Returns a structured TDD outline for the given document mode.',
      'Does NOT write to Notion. Use this to preview the document structure before creating.',
    ].join(' '),
    TddGenerateOutlineInputSchema.shape,
    async (input) => {
      try {
        const validated = TddGenerateOutlineInputSchema.parse(input);
        const result = generateTddOutline(validated.title, validated.mode, validated.context);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    }
  );

  // TddValidateDocumentInputSchema uses .refine() → ZodEffects, no .shape
  const validateDocumentShape = TddValidateDocumentInputSchema.innerType().shape;

  server.tool(
    'tdd_validate_document',
    [
      'Validates a TDD document for completeness. Returns a score (0–100), grade, and checklist.',
      'Shows which required sections are missing and which optional ones are empty.',
      'Provide either a page_id (to load from Notion) or a document object.',
    ].join(' '),
    validateDocumentShape,
    withAuth(async (input) => {
      try {
        const validated = TddValidateDocumentInputSchema.parse(input);
        if (validated.page_id) {
          // Load and parse actual page blocks — gives real section presence/content results.
          const result = await validateTddFromPage(validated.page_id);
          return ok(result);
        } else if (validated.document) {
          const result = validateTddDocument(validated.document);
          return ok(result);
        } else {
          return err('Provide either page_id or a document object.');
        }
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'tdd_generate_mermaid_diagram',
    [
      'Generates Mermaid diagram syntax from a type and natural-language description.',
      'Types: flowchart, sequence, class, entity_relationship, state, gantt, component.',
      'If save_locally is true, saves the .mmd file to generated/diagrams/.',
      'Notion renders Mermaid code blocks natively — paste mmd_content into a code block.',
    ].join(' '),
    TddGenerateMermaidInputSchema.shape,
    async (input) => {
      try {
        const validated = TddGenerateMermaidInputSchema.parse(input);
        const mmdContent = generateMermaidSyntax(
          validated.diagram_type,
          validated.description,
          validated.title
        );
        let filePath: string | undefined;
        if (validated.save_locally) {
          const basename = (validated.title ?? validated.diagram_type)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          filePath = await saveFile(mmdContent, basename, 'mmd', 'diagrams');
        }
        return ok({
          diagram_type: validated.diagram_type,
          mmd_content: mmdContent,
          saved_to: filePath,
          notion_tip:
            'Paste mmd_content into a Notion code block with language "mermaid" — Notion renders it natively.',
        });
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    'tdd_render_diagram',
    [
      'Renders a Mermaid .mmd string to SVG or PNG using the mmdc CLI.',
      'If mmdc is not installed, saves the .mmd source and returns install instructions.',
      'Always saves the .mmd source file to generated/diagrams/ regardless of outcome.',
    ].join(' '),
    TddRenderDiagramInputSchema.shape,
    async (input) => {
      try {
        const validated = TddRenderDiagramInputSchema.parse(input);
        const result = await renderMermaid(
          validated.mmd_content,
          validated.output_format,
          validated.filename_hint
        );
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    'tdd_export_markdown',
    'Exports a TDD Notion page to a local Markdown file in generated/exports/.',
    TddExportMarkdownInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = TddExportMarkdownInputSchema.parse(input);
        const result = await exportTddToMarkdown(validated.page_id, validated.filename);
        return ok({ filePath: result.filePath, preview: result.content.slice(0, 500) + '...' });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  // ── Notion Tools ──────────────────────────────────────────────────────────

  server.tool(
    'notion_search_pages',
    'Searches Notion workspace pages by title. Returns id, title, url, and lastEdited.',
    NotionSearchInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionSearchInputSchema.parse(input);
        const results = await searchNotionPages(validated.query, validated.limit);
        return ok({ count: results.length, results });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'notion_get_page',
    'Gets a Notion page by ID. Returns page metadata and optionally its first-level blocks.',
    NotionGetPageInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionGetPageInputSchema.parse(input);
        const result = await getNotionPage(validated.page_id, validated.include_blocks);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'notion_create_page',
    [
      'Creates a raw Notion page with the given blocks under the parent page.',
      'Low-level escape hatch — prefer tdd_create_document for TDDs.',
    ].join(' '),
    NotionCreatePageInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionCreatePageInputSchema.parse(input);
        const result = await createNotionPage(
          validated.title,
          validated.blocks as never[],
          validated.parent_page_id
        );
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'notion_update_page',
    'Updates the title of an existing Notion page. Requires confirm: true.',
    NotionUpdatePageInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionUpdatePageInputSchema.parse(input);
        if (!validated.confirm) {
          return err('confirm: true is required to update a Notion page.');
        }
        if (validated.title) {
          await updateNotionPageTitle(validated.page_id, validated.title);
        }
        return ok({ message: 'Page updated successfully.', page_id: validated.page_id });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'notion_append_blocks',
    'Appends raw Notion block objects to an existing page. Auto-chunks at 100 blocks.',
    NotionAppendBlocksInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionAppendBlocksInputSchema.parse(input);
        const result = await appendBlocksToPage(validated.page_id, validated.blocks as never[]);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  // ── Comment Tools ────────────────────────────────────────────────────────────

  server.tool(
    'notion_get_comments',
    [
      'Fetches all comment threads on a Notion page or a specific block.',
      'Returns grouped threads with author names, timestamps, and text.',
      'Use when the user wants to read, review, or respond to Notion comments.',
      'Pass block_id to fetch inline comments on a specific block instead of the whole page.',
    ].join(' '),
    NotionGetCommentsInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionGetCommentsInputSchema.parse(input);
        const targetId = validated.block_id ?? validated.page_id;
        const threads = await getPageComments(targetId);
        return ok({ total_threads: threads.length, threads });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'notion_reply_comment',
    [
      'Replies to an existing Notion comment thread using its discussion_id.',
      'Use when the user wants to answer, respond to, or continue a comment thread.',
      'Get the discussion_id from notion_get_comments first.',
    ].join(' '),
    NotionReplyCommentInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionReplyCommentInputSchema.parse(input);
        const result = await createNotionComment({
          discussion_id: validated.discussion_id,
          text: withAttribution(validated.text),
        });
        return ok({ success: true, comment_id: result.id, discussion_id: result.discussion_id });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'notion_add_comment',
    [
      'Creates a new top-level comment thread on a Notion page.',
      'Use when the user wants to leave a new comment (not a reply to an existing thread).',
      'To reply to an existing thread, use notion_reply_comment with a discussion_id instead.',
    ].join(' '),
    NotionAddCommentInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = NotionAddCommentInputSchema.parse(input);
        const result = await createNotionComment({
          block_id: validated.page_id,
          text: withAttribution(validated.text),
        });
        return ok({ success: true, comment_id: result.id, discussion_id: result.discussion_id });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  // ── Image Prompt / Generation Tool ──────────────────────────────────────────

  server.tool(
    'tdd_generate_image_prompt',
    [
      'Generates a detailed image prompt for concept art, architecture illustrations, or product mockups.',
      'Provider resolution order (IMAGE_PROVIDER=auto): OpenAI DALL-E 3 if OPENAI_API_KEY is set,',
      'then Claude path (SVG/Mermaid/prompts only — no bitmap), then placeholder.',
      'Supported IMAGE_PROVIDER values: auto (default), openai, claude, none.',
      'If a bitmap provider is configured (openai + key), attempts real image generation.',
      'Otherwise returns a structured prompt plus a compact Notion placeholder.',
      'Use when the user asks for visual images — not diagrams.',
      'Check VISUAL_GENERATION_ENABLED, IMAGE_PROVIDER, and DOCUMENT_QUALITY_MODE to control behavior.',
    ].join(' '),
    TddGenerateImagePromptInputSchema.shape,
    async (input) => {
      try {
        const validated = TddGenerateImagePromptInputSchema.parse(input);
        const visual = getVisualConfig();

        const styleGuides: Record<string, string> = {
          minimal: 'clean lines, white background, soft shadows, minimal color palette, modern sans-serif labels',
          technical: 'technical diagram style, precise geometry, dark background, monospace annotations, blueprint aesthetic',
          product: 'product UI mockup style, realistic device frames, light background, clean typography, friendly colors',
          infographic: 'infographic style, bold icons, clear hierarchy, accent colors, readable labels',
        };

        const visualDescriptions: Record<string, string> = {
          product_concept: 'a product concept illustration',
          architecture_illustration: 'a system architecture illustration',
          app_mockup: 'an app screen mockup',
          data_ownership: 'a data ownership and privacy model diagram',
          ai_agent_workflow: 'an AI agent workflow illustration',
          device_to_cloud: 'a device-to-cloud data flow illustration',
          roadmap_visual: 'a product roadmap visual timeline',
          user_journey: 'a user journey map illustration',
        };

        const visualDesc = visualDescriptions[validated.visual_type] ?? 'a technical illustration';
        const styleDesc = styleGuides[validated.style ?? 'minimal'] ?? styleGuides.minimal;

        const prompt = [
          `Create ${visualDesc} for: ${validated.feature_description}.`,
          `Style: ${styleDesc}.`,
          `The image should be clear, professional, and support engineering or product understanding.`,
          `Do not add decorative elements that don't relate to the subject.`,
          `No text overlays unless labels are directly relevant to the content.`,
        ].join(' ');

        // Attempt real bitmap generation if a provider is configured
        if (visual.bitmapAvailable) {
          try {
            const result = await generateBitmapImage(prompt, visual);
            if (result) {
              return ok({
                visual_type: validated.visual_type,
                style: validated.style,
                image_prompt: prompt,
                generated: true,
                provider_used: result.provider,
                image_url: result.url,
                notion_tip: [
                  'Insert the image into Notion using notion_append_blocks with an image block.',
                  `The image_url is a temporary ${result.provider} CDN URL — download and host it if you need it long-term.`,
                ].join(' '),
              });
            }
          } catch (genErr) {
            const genErrMsg = genErr instanceof Error ? genErr.message : String(genErr);
            logger.warn('Bitmap image generation failed, falling back to placeholder', {
              provider: visual.detectedProvider,
              error: genErrMsg,
            });
            const notionPlaceholder = buildImagePlaceholder(
              visualDescriptions[validated.visual_type] ?? validated.visual_type,
              prompt,
              visual.detectedProvider,
            );
            return ok({
              visual_type: validated.visual_type,
              style: validated.style,
              image_prompt: prompt,
              generated: false,
              provider_attempted: visual.detectedProvider,
              generation_error: genErrMsg,
              notion_placeholder: notionPlaceholder,
              notion_tip: 'Generation failed. Add the placeholder using page_design_add_section with section_type="callout", icon="📸".',
            });
          }
        }

        // Placeholder path — no bitmap provider available
        const notionPlaceholder = buildImagePlaceholder(
          visualDescriptions[validated.visual_type] ?? validated.visual_type,
          prompt,
          visual.detectedProvider,
        );

        const generationOptions: string[] = [
          'OpenAI DALL-E 3: Set IMAGE_PROVIDER=openai (or auto) + OPENAI_API_KEY in .env.',
          'Midjourney: Paste image_prompt into Discord, prefix with /imagine.',
          'Stable Diffusion: Use image_prompt with "--ar 16:9 --style raw" for technical illustrations.',
        ];
        if (visual.detectedProvider === 'claude') {
          generationOptions.unshift(
            'Claude path active: Mermaid/SVG diagrams are available via tdd_add_mermaid_to_page.',
          );
        }

        return ok({
          visual_type: validated.visual_type,
          style: validated.style,
          image_prompt: prompt,
          generated: false,
          visual_config: {
            enabled: visual.enabled,
            provider_preference: visual.providerPreference,
            detected_provider: visual.detectedProvider,
            bitmap_available: visual.bitmapAvailable,
            can_generate: visual.canGenerate,
            warning: visual.warningMessage,
          },
          notion_placeholder: notionPlaceholder,
          notion_tip: [
            'Add the placeholder to Notion using page_design_add_section with',
            'section_type="callout", icon="📸", and content=notion_placeholder.',
            'For diagrams, use tdd_add_mermaid_to_page instead.',
          ].join(' '),
          generation_options: generationOptions,
        });
      } catch (e) {
        return handleError(e);
      }
    }
  );

  // ── Add Mermaid to Page Tool ───────────────────────────────────────────────

  server.tool(
    'tdd_add_mermaid_to_page',
    [
      'Generates a Mermaid diagram and appends it to an existing Notion page in one step.',
      'Combines tdd_generate_mermaid_diagram + tdd_append_section.',
      'Adds a heading, the mermaid code block, and a divider.',
      'Customize the returned mmd_content if needed before it is appended.',
    ].join(' '),
    TddAddMermaidToPageInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = TddAddMermaidToPageInputSchema.parse(input);

        // 1. Generate diagram syntax
        const mmdContent = generateMermaidSyntax(
          validated.diagram_type,
          validated.description,
          validated.title
        );

        // 2. Optionally save locally
        let filePath: string | undefined;
        if (validated.save_locally) {
          const basename = (validated.title ?? validated.diagram_type)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          filePath = await saveFile(mmdContent, basename, 'mmd', 'diagrams');
        }

        // 3. Append to Notion page
        const result = await appendSectionToPage({
          page_id: validated.page_id,
          heading: validated.title ?? `${validated.diagram_type.replace(/_/g, ' ')} diagram`,
          content: `\`\`\`mermaid\n${mmdContent}\n\`\`\``,
          level: 'heading_2',
        });

        return ok({
          message: `Mermaid ${validated.diagram_type} diagram appended to page.`,
          diagram_type: validated.diagram_type,
          mmd_content: mmdContent,
          saved_to: filePath,
          appendedCount: result.appendedCount,
          notion_tip: 'The diagram is in a code block with language "mermaid" — Notion renders it natively.',
        });
      } catch (e) {
        return handleError(e);
      }
    })
  );

  // ── System Overview Tools ─────────────────────────────────────────────────

  server.tool(
    'system_overview_create_document',
    [
      'Creates a System Overview / Product Architecture Overview document and publishes it to Notion.',
      'Use this for parent-level documents that describe what is being built, the product vision,',
      'core modules, architecture, data ownership, AI strategy, MVP scope, and roadmap.',
      'This is NOT a TDD — it is the parent document. Use tdd_create_document for module-level TDDs.',
      'Supports dry_run: true to preview without writing. Searches for duplicates first.',
      'Returns the created document structure, Notion URL, and page ID.',
    ].join(' '),
    SystemOverviewCreateInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = SystemOverviewCreateInputSchema.parse(input);
        const result = await createSystemOverviewDocument(validated);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'system_overview_create_child_tdds',
    [
      'Creates child TDD pages under an existing System Overview page — one per module.',
      'Reads the Core Modules table from the overview page to auto-detect module names,',
      'or accepts an explicit "modules" list. Creates each child as "TDD — [Module Name]"',
      'nested under the System Overview page in Notion.',
      'Skips modules that already have a child TDD page (configurable with skip_existing).',
      'After creating, updates the "Child Technical Design Documents" section of the overview.',
      'Use dry_run: true to preview which TDDs would be created without writing.',
    ].join(' '),
    SystemOverviewCreateChildTddsInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = SystemOverviewCreateChildTddsInputSchema.parse(input);
        const result = await createChildTddsFromOverview(validated);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  // ── Design Page Tools ─────────────────────────────────────────────────────

  server.tool(
    'page_design_create',
    [
      'Creates a visually designed Notion page using a named document template.',
      'Templates: product_brief, meeting_notes, project_roadmap, design_spec, changelog, onboarding_guide, runbook.',
      'Supports emoji icon, external cover image, and dry_run preview.',
      'Returns Notion URL, page ID, section list, and block count.',
    ].join(' '),
    PageDesignCreateInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = PageDesignCreateInputSchema.parse(input);
        const result = await createDesignPageDocument(validated);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  server.tool(
    'page_design_preview',
    [
      'Returns the section structure and block count for any design template without writing to Notion.',
      'Also lists all available templates. Use this to explore templates before calling page_design_create.',
    ].join(' '),
    PageDesignPreviewInputSchema.shape,
    async (input) => {
      try {
        const validated = PageDesignPreviewInputSchema.parse(input);
        const result = previewDesignTemplate(validated.template, validated.title ?? 'Untitled');
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    'page_design_add_section',
    [
      'Appends a styled section to any existing Notion page.',
      'Section types: callout (icon + colored background), table (pipe-separated data), toggle (expandable),',
      'steps (numbered list), action_items (checkbox todos).',
      'Requires confirm: true.',
    ].join(' '),
    PageDesignAddSectionInputSchema.shape,
    withAuth(async (input) => {
      try {
        const validated = PageDesignAddSectionInputSchema.parse(input);
        if (!validated.confirm) {
          return err('confirm: true is required to append a section to a page.');
        }
        const result = await addDesignSection(validated);
        return ok(result);
      } catch (e) {
        return handleError(e);
      }
    })
  );

  // ── MCP Prompts ───────────────────────────────────────────────────────────

  // ── MCP Prompts ───────────────────────────────────────────────────────────

  server.tool(
    'document_detect_type',
    [
      'Detects what type of document a user prompt is asking for.',
      'Returns: "system_overview", "tdd", "feature_design", "internal_readme", or "unknown".',
      'Useful when you need to decide which creation tool to call.',
    ].join(' '),
    { prompt: z.string().min(1).describe('The user prompt to analyze') },
    (input) => {
      const { prompt } = input as { prompt: string };
      const detected = detectDocumentType(prompt);
      return Promise.resolve(ok({
        detected_type: detected,
        recommendation:
          detected === 'system_overview'
            ? 'Use system_overview_create_document to create a System Overview / Product Architecture Overview.'
            : detected === 'tdd'
            ? 'Use tdd_create_document to create a Technical Design Document.'
            : detected === 'feature_design'
            ? 'Use tdd_create_document with mode="large_feature" and a title prefixed with "Feature Design —" to create a Feature Design document.'
            : detected === 'internal_readme'
            ? 'Use tdd_create_document or page_design_create to create an internal developer README or setup guide.'
            : 'Could not detect document type. Ask the user to clarify: System Overview, Feature Design, or TDD?',
      }));
    }
  );

  server.prompt(
    'tdd_new_service',
    'Generate a complete TDD for a new backend service',
    {
      service_name: z.string().describe('Name of the new service'),
      owner: z.string().describe('Document owner (name or @handle)'),
      context: z.string().optional().describe('Brief description of what the service does'),
    },
    async ({ service_name, owner, context }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Create a comprehensive TDD for a new service called "${service_name}".`,
              `Owner: ${owner}.`,
              context ? `Context: ${context}` : '',
              ``,
              `Steps:`,
              `1. Call notion_check_auth first to verify Notion is configured.`,
              `2. Use tdd_create_document with mode="new_service".`,
              `3. Generate architecture diagram with tdd_generate_mermaid_diagram (type: "component").`,
              `4. Generate sequence diagram for the main flow (type: "sequence").`,
              `5. Run tdd_validate_document to check completeness.`,
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'tdd_api_change',
    'Generate a TDD for an API breaking change',
    {
      api_name: z.string().describe('Name of the API being changed'),
      owner: z.string().describe('Document owner'),
      change_summary: z.string().describe('What is changing and why'),
    },
    async ({ api_name, owner, change_summary }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Create a TDD for an API change to "${api_name}".`,
              `Owner: ${owner}. Change: ${change_summary}`,
              ``,
              `Steps:`,
              `1. Call notion_check_auth first.`,
              `2. Use tdd_create_document with mode="api_change".`,
              `3. Generate a sequence diagram showing before/after flow.`,
              `4. Document API contract changes in the API/Interfaces section.`,
              `5. Detail the rollout plan including versioning and deprecation strategy.`,
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'tdd_incident_followup',
    'Generate a post-incident TDD with root cause and prevention plan',
    {
      incident_title: z.string().describe('Short title of the incident'),
      owner: z.string().describe('Document owner'),
      severity: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('Incident severity'),
    },
    async ({ incident_title, owner, severity }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Create an incident follow-up TDD for: "${incident_title}".`,
              `Owner: ${owner}.${severity ? ` Severity: ${severity}.` : ''}`,
              ``,
              `Steps:`,
              `1. Call notion_check_auth first.`,
              `2. Use tdd_create_document with mode="incident_followup".`,
              `3. Generate a sequence diagram showing what went wrong.`,
              `4. Fill in Problem/Context with a timeline.`,
              `5. Document the root cause in Proposed Solution.`,
              `6. List error handling improvements and observability gaps.`,
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'design_product_brief',
    'Create a fully designed Product Brief page in Notion',
    {
      feature_name: z.string().describe('Name of the feature or initiative'),
      owner: z.string().describe('Document owner (name or @handle)'),
      context: z.string().optional().describe('One-line description of the feature'),
    },
    async ({ feature_name, owner, context }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Create a Product Brief for "${feature_name}".`,
              `Owner: ${owner}.`,
              context ? `Context: ${context}` : '',
              ``,
              `Steps:`,
              `1. Call notion_check_auth to verify Notion credentials.`,
              `2. Call page_design_preview with template="product_brief" to confirm the structure.`,
              `3. Call page_design_create with template="product_brief", title="${feature_name}", owner="${owner}"${context ? `, context="${context}"` : ''}.`,
              `4. If the feature has a user flow worth diagramming, call tdd_generate_mermaid_diagram`,
              `   with diagram_type="flowchart" and use page_design_add_section to add it.`,
              `5. Return the Notion URL so the user can open it directly.`,
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'system_overview_new',
    'Create a System Overview / Product Architecture Overview document in Notion',
    {
      product_name: z.string().describe('Name of the product or platform'),
      owner: z.string().describe('Document owner (name or @handle)'),
      context: z.string().optional().describe('One-line description of what is being built'),
    },
    async ({ product_name, owner, context }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Create a System Overview for "${product_name}".`,
              `Owner: ${owner}.`,
              context ? `Context: ${context}` : '',
              ``,
              `Steps:`,
              `1. Call notion_check_auth to verify Notion credentials.`,
              `2. Call system_overview_create_document with title="System Overview — ${product_name}", owner="${owner}"${context ? `, context="${context}"` : ''}.`,
              `3. Add a high-level architecture diagram using tdd_add_mermaid_to_page (type: "component").`,
              `4. Add a user flow diagram using tdd_add_mermaid_to_page (type: "flowchart").`,
              `5. Return the Notion URL so the user can open and complete the document.`,
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    })
  );

  // ── Transport ─────────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('notion-tdd-agent started', { version: '1.0.0' });

  process.on('uncaughtException', (e) => {
    logger.error('Uncaught exception', { error: e.message, stack: e.stack });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  process.stderr.write(
    JSON.stringify({ level: 'fatal', msg: String(e), time: new Date().toISOString() }) + '\n'
  );
  process.exit(1);
});
