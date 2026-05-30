/**
 * Visual generation config and interfaces.
 *
 * Reads VISUAL_GENERATION_ENABLED, IMAGE_PROVIDER, OPENAI_API_KEY,
 * and DOCUMENT_QUALITY_MODE from the environment.
 *
 * Default provider: auto — provider-neutral; no API key required by default.
 *
 * Provider resolution order (IMAGE_PROVIDER=auto):
 *   1. OpenAI (DALL-E 3) — only if OPENAI_API_KEY is set
 *   2. Claude path — SVG/Mermaid/HTML diagrams + rich prompts (no bitmap)
 */

export type ImageProviderPreference =
  | 'auto'
  | 'claude'
  | 'openai'
  | 'stability'
  | 'replicate'
  | 'local'
  | 'none';

export type DetectedProvider = 'openai' | 'claude' | 'none';

export interface VisualConfig {
  enabled: boolean;
  /** Raw value of IMAGE_PROVIDER env var */
  providerPreference: ImageProviderPreference;
  /** Resolved provider after capability detection */
  detectedProvider: DetectedProvider;
  qualityMode: 'draft' | 'polished';
  hasOpenAiKey: boolean;
  /** True when a real bitmap image API (e.g. DALL-E 3) is available */
  bitmapAvailable: boolean;
  /**
   * True when any non-placeholder visual generation is active.
   * Includes both bitmap generation and Claude SVG/diagram path.
   */
  canGenerate: boolean;
  warningMessage?: string;
  // Legacy aliases for backward compatibility
  /** @deprecated Use hasOpenAiKey */
  hasApiKey: boolean;
  /** @deprecated Use detectedProvider */
  provider: string;
}

export function getVisualConfig(): VisualConfig {
  const enabled = (process.env.VISUAL_GENERATION_ENABLED ?? 'true') !== 'false';
  const rawProvider = (process.env.IMAGE_PROVIDER ?? 'auto').toLowerCase().trim();
  const providerPreference = rawProvider as ImageProviderPreference;
  const rawMode = process.env.DOCUMENT_QUALITY_MODE ?? 'polished';
  const qualityMode: 'draft' | 'polished' = rawMode === 'draft' ? 'draft' : 'polished';
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  // Detect the best available provider
  let detectedProvider: DetectedProvider;
  switch (providerPreference) {
    case 'auto':
      // auto: prefer OpenAI if key is present, fall back to Claude path
      detectedProvider = hasOpenAiKey ? 'openai' : 'claude';
      break;
    case 'openai':
      detectedProvider = hasOpenAiKey ? 'openai' : 'none';
      break;
    case 'claude':
      // Claude path: no bitmap images, but richer SVG/Mermaid/HTML output than plain placeholders
      detectedProvider = 'claude';
      break;
    case 'none':
      detectedProvider = 'none';
      break;
    default:
      // stability, replicate, local — not yet implemented
      detectedProvider = 'none';
      break;
  }

  // bitmapAvailable: a real image API can be called to produce PNG/JPEG URLs
  const bitmapAvailable = enabled && qualityMode !== 'draft' && detectedProvider === 'openai';

  // canGenerate: any non-placeholder output is possible (bitmap OR Claude SVG/diagram path)
  const canGenerate = enabled && qualityMode !== 'draft' && detectedProvider !== 'none';

  let warningMessage: string | undefined;
  if (enabled && qualityMode !== 'draft') {
    if (providerPreference === 'openai' && !hasOpenAiKey) {
      warningMessage =
        'IMAGE_PROVIDER=openai is set but OPENAI_API_KEY is missing. ' +
        'Falling back to Mermaid/SVG diagrams and placeholder prompts. ' +
        'Add OPENAI_API_KEY to your .env to enable OpenAI bitmap generation.';
    } else if (!['auto', 'openai', 'claude', 'none'].includes(providerPreference)) {
      warningMessage =
        `IMAGE_PROVIDER=${providerPreference} is not yet supported. ` +
        'Falling back to Mermaid/SVG diagrams and placeholders. ' +
        'Supported values: auto (default), claude, openai, none.';
    }
    // No warning for claude (default) or auto-resolving to claude — this is the expected path.
  }

  return {
    enabled,
    providerPreference,
    detectedProvider,
    qualityMode,
    hasOpenAiKey,
    bitmapAvailable,
    canGenerate,
    warningMessage,
    // Legacy aliases
    hasApiKey: hasOpenAiKey,
    provider: detectedProvider,
  };
}

export interface GeneratedVisual {
  visualType: string;
  purpose: string;
  prompt: string;
  caption: string;
  /** External URL (e.g. from OpenAI DALL-E) — present when isPlaceholder is false */
  url?: string;
  isPlaceholder: boolean;
  error?: string;
}
