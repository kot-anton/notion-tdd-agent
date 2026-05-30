/**
 * Visual provider factory.
 *
 * Dispatches bitmap image generation to the detected provider.
 * Returns null when no bitmap provider is available — caller should fall back
 * to Mermaid / SVG / placeholder path.
 *
 * Provider resolution is determined by VisualConfig (see imageProvider.ts):
 *   openai  → DALL-E 3 via OpenAI API
 *   claude  → no bitmap generation; caller uses SVG/Mermaid/HTML path
 *   none    → no generation; caller uses placeholder path
 */

import { generateOpenAiImage } from './openAiImageProvider.js';
import type { VisualConfig } from './imageProvider.js';

export interface BitmapResult {
  url: string;
  provider: 'openai';
}

/**
 * Attempts to generate a bitmap image using the configured provider.
 *
 * @returns BitmapResult with a temporary image URL, or null if no bitmap
 *          provider is available or the call fails.
 */
export async function generateBitmapImage(
  prompt: string,
  config: VisualConfig,
): Promise<BitmapResult | null> {
  if (!config.bitmapAvailable) return null;

  if (config.detectedProvider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const { url } = await generateOpenAiImage(prompt, apiKey);
    return { url, provider: 'openai' };
  }

  // Future: stability, replicate, local
  return null;
}
