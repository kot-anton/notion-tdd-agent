/**
 * Visual planner for System Overview and partner-facing documents.
 *
 * Decides which visuals are useful, builds prompts, and either generates
 * real bitmap images (via the configured provider), or returns placeholder
 * entries with rich Mermaid/SVG/prompt content for the Claude path.
 */

import { getVisualConfig, type GeneratedVisual } from './imageProvider.js';
import { generateBitmapImage } from './visualProviderFactory.js';
import { logger } from '../utils/logger.js';

export interface PlannedVisual {
  visualType: string;
  purpose: string;
  /** Use {context} as placeholder for the feature/product description */
  promptTemplate: string;
  caption: string;
  style: 'minimal' | 'technical' | 'product' | 'infographic';
}

// 6 high-value visuals for a System Overview / partner-facing document.
export const SYSTEM_OVERVIEW_VISUALS: PlannedVisual[] = [
  {
    visualType: 'product_concept',
    purpose: 'Hero — investor/partner product overview',
    promptTemplate: 'Product concept illustration for {context}',
    caption: 'Product Hero',
    style: 'product',
  },
  {
    visualType: 'architecture_illustration',
    purpose: 'High-level system architecture',
    promptTemplate: 'High-level system architecture diagram for {context}',
    caption: 'High-Level System Architecture',
    style: 'technical',
  },
  {
    visualType: 'data_ownership',
    purpose: 'Data ownership and privacy model',
    promptTemplate: 'User data ownership and privacy model diagram for {context}',
    caption: 'Data Ownership & Privacy Model',
    style: 'minimal',
  },
  {
    visualType: 'user_journey',
    purpose: 'Core user journey',
    promptTemplate: 'Core user journey and product UI mockup for {context}',
    caption: 'Core User Journey',
    style: 'product',
  },
  {
    visualType: 'ai_agent_workflow',
    purpose: 'Key workflow diagram',
    promptTemplate: 'Primary workflow diagram for {context}',
    caption: 'Key Workflow Diagram',
    style: 'technical',
  },
  {
    visualType: 'device_to_cloud',
    purpose: 'Data flow diagram',
    promptTemplate: 'Data flow and processing pipeline diagram for {context}',
    caption: 'Data Flow Diagram',
    style: 'minimal',
  },
];

const STYLE_GUIDES: Record<string, string> = {
  minimal:
    'clean lines, white background, soft shadows, minimal color palette, modern sans-serif labels',
  technical:
    'technical diagram style, precise geometry, dark background, monospace annotations, blueprint aesthetic',
  product:
    'product UI mockup style, realistic device frames, light background, clean typography, friendly colors',
  infographic:
    'infographic style, bold icons, clear visual hierarchy, accent colors, readable labels',
};

export function buildImagePrompt(
  template: string,
  context: string,
  style: string,
): string {
  const base = template.replace('{context}', context || 'this product');
  const styleDesc = STYLE_GUIDES[style] ?? STYLE_GUIDES.minimal;
  return [
    `Create ${base}.`,
    `Style: ${styleDesc}.`,
    `The image should be clear, professional, and suitable for a technical or product document.`,
    `No decorative elements unrelated to the subject.`,
    `No text overlays unless labels are directly relevant.`,
  ].join(' ');
}

export interface VisualPlanResult {
  visuals: GeneratedVisual[];
  mode: 'generated' | 'placeholder';
  /** Which provider was used */
  usedProvider: string;
  warningMessage?: string;
  generatedCount: number;
  placeholderCount: number;
}

/**
 * Main entry point. Generates visuals if a bitmap provider is configured;
 * falls back to rich placeholders (with Mermaid/SVG prompts) otherwise.
 *
 * @param context - Product/feature description used in prompts
 * @param plans - Which visuals to produce (defaults to SYSTEM_OVERVIEW_VISUALS)
 */
export async function planAndGenerateVisuals(
  context: string,
  plans: PlannedVisual[] = SYSTEM_OVERVIEW_VISUALS,
): Promise<VisualPlanResult> {
  const config = getVisualConfig();

  if (!config.enabled || config.qualityMode === 'draft' || !config.bitmapAvailable) {
    return buildPlaceholderResult(plans, context, config.detectedProvider, config.warningMessage);
  }

  const visuals: GeneratedVisual[] = [];
  let generatedCount = 0;
  let placeholderCount = 0;

  for (const plan of plans) {
    const prompt = buildImagePrompt(plan.promptTemplate, context, plan.style);
    try {
      logger.info('Generating image', { visualType: plan.visualType, provider: config.detectedProvider });
      const result = await generateBitmapImage(prompt, config);
      if (!result) {
        throw new Error(`Provider ${config.detectedProvider} returned no result`);
      }
      visuals.push({
        visualType: plan.visualType,
        purpose: plan.purpose,
        prompt,
        caption: plan.caption,
        url: result.url,
        isPlaceholder: false,
      });
      generatedCount++;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.warn('Image generation failed, using placeholder', {
        visualType: plan.visualType,
        provider: config.detectedProvider,
        error: errorMsg,
      });
      visuals.push({
        visualType: plan.visualType,
        purpose: plan.purpose,
        prompt,
        caption: plan.caption,
        isPlaceholder: true,
        error: errorMsg,
      });
      placeholderCount++;
    }
  }

  return {
    visuals,
    mode: generatedCount > 0 ? 'generated' : 'placeholder',
    usedProvider: config.detectedProvider,
    generatedCount,
    placeholderCount,
  };
}

function buildPlaceholderResult(
  plans: PlannedVisual[],
  context: string,
  detectedProvider: string,
  warningMessage?: string,
): VisualPlanResult {
  const visuals: GeneratedVisual[] = plans.map((plan) => ({
    visualType: plan.visualType,
    purpose: plan.purpose,
    prompt: buildImagePrompt(plan.promptTemplate, context, plan.style),
    caption: plan.caption,
    isPlaceholder: true,
  }));
  return {
    visuals,
    mode: 'placeholder',
    usedProvider: detectedProvider,
    warningMessage,
    generatedCount: 0,
    placeholderCount: visuals.length,
  };
}

/**
 * Renders a compact Markdown table for placeholder visuals.
 * Preferred over large repeated callout blocks in partner-facing documents.
 */
export function buildVisualPlaceholderTable(visuals: GeneratedVisual[]): string {
  const rows = visuals.map((v) => {
    const shortPrompt =
      v.prompt.length > 90 ? v.prompt.slice(0, 87) + '...' : v.prompt;
    return `| ${v.caption} | ${v.purpose} | ${shortPrompt} | Placeholder |`;
  });
  return [
    '| Visual | Purpose | Prompt / Notes | Status |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}
