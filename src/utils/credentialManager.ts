import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { resetNotionClient } from '../notion/notionClient.js';

// Always resolve .env relative to the current working directory so that both
// local development (cwd = project root) and npx usage (cwd = user directory)
// consistently read and write the same file that dotenv/config loads.
const ENV_PATH = path.resolve(process.cwd(), '.env');

export interface AuthStatus {
  ok: boolean;
  hasToken: boolean;
  hasPageId: boolean;
  missing: ('NOTION_TOKEN' | 'NOTION_PARENT_PAGE_ID')[];
}

export function checkAuthStatus(): AuthStatus {
  const hasToken = Boolean(process.env.NOTION_TOKEN?.trim());
  const hasPageId = Boolean(process.env.NOTION_PARENT_PAGE_ID?.trim());
  const missing: AuthStatus['missing'] = [];
  if (!hasToken) missing.push('NOTION_TOKEN');
  if (!hasPageId) missing.push('NOTION_PARENT_PAGE_ID');
  return { ok: missing.length === 0, hasToken, hasPageId, missing };
}

async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(ENV_PATH, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return vars;
  } catch {
    return {};
  }
}

function serializeEnv(vars: Record<string, string>): string {
  const knownOrder = [
    'NOTION_TOKEN',
    'NOTION_PARENT_PAGE_ID',
    'NOTION_VERSION',
    'GENERATED_FILES_DIR',
    'LOG_LEVEL',
    'VISUAL_GENERATION_ENABLED',
    'IMAGE_PROVIDER',
    'OPENAI_API_KEY',
    'DOCUMENT_QUALITY_MODE',
  ];
  const lines: string[] = [];
  for (const key of knownOrder) {
    if (key in vars) lines.push(`${key}=${vars[key]}`);
  }
  for (const [key, val] of Object.entries(vars)) {
    if (!knownOrder.includes(key)) lines.push(`${key}=${val}`);
  }
  return lines.join('\n') + '\n';
}

export interface SaveCredentialsInput {
  token?: string;
  page_id?: string;
}

export async function saveCredentials(input: SaveCredentialsInput): Promise<{
  saved: string[];
  envPath: string;
}> {
  const current = await readEnvFile();
  const saved: string[] = [];

  if (input.token) {
    current['NOTION_TOKEN'] = input.token.trim();
    process.env.NOTION_TOKEN = input.token.trim();
    saved.push('NOTION_TOKEN');
  }
  if (input.page_id) {
    const normalized = input.page_id.trim().replace(/-/g, '');
    current['NOTION_PARENT_PAGE_ID'] = normalized;
    process.env.NOTION_PARENT_PAGE_ID = normalized;
    saved.push('NOTION_PARENT_PAGE_ID');
  }
  if (!current['NOTION_VERSION']) current['NOTION_VERSION'] = '2022-06-28';
  if (!current['GENERATED_FILES_DIR']) current['GENERATED_FILES_DIR'] = 'generated';
  if (!current['LOG_LEVEL']) current['LOG_LEVEL'] = 'info';
  if (!('VISUAL_GENERATION_ENABLED' in current)) current['VISUAL_GENERATION_ENABLED'] = 'true';
  if (!current['IMAGE_PROVIDER']) current['IMAGE_PROVIDER'] = 'auto';
  if (!current['DOCUMENT_QUALITY_MODE']) current['DOCUMENT_QUALITY_MODE'] = 'polished';

  await fs.writeFile(ENV_PATH, serializeEnv(current), 'utf-8');

  // Reset the cached Notion client so the next API call uses the new token.
  if (input.token) resetNotionClient();

  logger.info('Credentials saved', { saved, path: ENV_PATH });
  return { saved, envPath: ENV_PATH };
}

export function buildSetupGuide(status: AuthStatus): string {
  const steps: string[] = [];

  if (!status.hasToken) {
    steps.push(
      `## Step 1 — Create a Notion connection & get your Access Token\n` +
      `\n` +
      `1. Open: **https://app.notion.com/developers/connections**\n` +
      `2. Click **+ New connection** (top right)\n` +
      `3. Fill in the modal:\n` +
      `   - **Connection name:** My Notion TDD Agent\n` +
      `   - **Authentication method:** Access token ← select this\n` +
      `   - **Installable in:** your workspace (leave as-is)\n` +
      `4. Click **Create connection**\n` +
      `5. On the next screen, click **Show** next to the Access Token field\n` +
      `6. Copy the token — it starts with \`secret_\` or \`ntn_\`\n` +
      `\n` +
      `→ **Share the token with me and I will save it automatically using \`notion_save_credentials\`.**`
    );
  }

  if (!status.hasPageId) {
    const stepNum = !status.hasToken ? 2 : 1;
    steps.push(
      `## Step ${stepNum} — Share a Notion page with your connection\n` +
      `\n` +
      `1. Open Notion and go to (or create) the page where TDDs should be saved\n` +
      `   - Suggestion: create a page called **Technical Design Documents**\n` +
      `2. Click **…** (three dots, top-right of the page)\n` +
      `3. Click **Connections** → find **My Notion TDD Agent** → toggle it **on**\n` +
      `4. Copy the page URL from your browser address bar:\n` +
      `   \`https://www.notion.so/Your-Workspace/Page-Title-abc123def456...\`\n` +
      `5. The last part after the final **-** is your Page ID (32 hex characters)\n` +
      `   Example: \`abc123def456abc123def456abc123de\`\n` +
      `\n` +
      `→ **Share the Page ID with me and I will save it automatically.**`
    );
  }

  const missingList = status.missing.join(' and ');
  return (
    `# Notion Setup Required\n\n` +
    `I need your **${missingList}** before I can create documents in Notion.\n` +
    `This is a one-time setup — credentials are saved to your local \`.env\` file.\n\n` +
    steps.join('\n\n')
  );
}
