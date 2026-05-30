#!/usr/bin/env node
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { execSync, spawnSync } from 'child_process';
import { checkAuthStatus } from './utils/credentialManager.js';

const command = (process.argv[2] ?? 'help').toLowerCase();
const cliArgs = process.argv.slice(3);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFlag(flag: string, short?: string): string | undefined {
  for (let i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === flag || (short && cliArgs[i] === short)) {
      return cliArgs[i + 1];
    }
  }
}

async function promptVisible(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);

    const stdin = process.stdin as NodeJS.ReadStream;

    if (!process.stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      // Non-TTY fallback (CI, piped input)
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let secret = '';

    const onData = (ch: Buffer | string): void => {
      const c = ch.toString();
      if (c === '\n' || c === '\r' || c === '') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(secret);
      } else if (c === '') {
        process.exit(0);
      } else if (c === '' || c === '\b') {
        if (secret.length > 0) {
          secret = secret.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        secret += c;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

function claudeAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function mcpRegistered(serverName: string): boolean {
  try {
    const result = spawnSync('claude', ['mcp', 'get', serverName], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    // Exit 0 and output containing the server name means it's registered
    return result.status === 0 && result.stdout.includes(serverName);
  } catch {
    return false;
  }
}

interface RegisterResult {
  success: boolean;
  message: string;
}

async function registerMcpServer(scope: string): Promise<RegisterResult> {
  const token = process.env.NOTION_TOKEN?.trim() ?? '';
  const pageId = process.env.NOTION_PARENT_PAGE_ID?.trim() ?? '';

  if (!token || !pageId) {
    return {
      success: false,
      message: 'Missing credentials — run npx notion-tdd-agent init first',
    };
  }

  const mcpJson = JSON.stringify({
    type: 'stdio',
    command: 'npx',
    args: ['notion-tdd-agent', 'server'],
    env: {
      NOTION_TOKEN: token,
      NOTION_PARENT_PAGE_ID: pageId,
    },
  });

  const result = spawnSync(
    'claude',
    ['mcp', 'add-json', '--scope', scope, 'notion-tdd-agent', mcpJson],
    { encoding: 'utf8', stdio: 'pipe' }
  );

  if (result.status === 0) {
    return { success: true, message: `Registered with --scope ${scope}` };
  }

  const stderr = (result.stderr ?? '').trim();
  const stdout = (result.stdout ?? '').trim();
  const detail = stderr || stdout || `exit code ${result.status ?? '?'}`;

  // If server already registered, treat as success
  if (detail.includes('already') || detail.includes('exists')) {
    return { success: true, message: `Already registered (${detail})` };
  }

  return { success: false, message: detail };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function runInit(): Promise<void> {
  const envPath = path.resolve(process.cwd(), '.env');

  console.log('\n=== Notion TDD Agent — Setup ===\n');

  // Check if .env already exists with content
  let existingEnv: Record<string, string> = {};
  let envExists = false;
  try {
    await fs.access(envPath);
    envExists = true;
    const content = await fs.readFile(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (val) existingEnv[key] = val;
    }
  } catch {
    // .env doesn't exist yet
  }

  const hasExistingCreds =
    Boolean(existingEnv['NOTION_TOKEN']) && Boolean(existingEnv['NOTION_PARENT_PAGE_ID']);

  let token: string;
  let pageId: string;

  if (hasExistingCreds) {
    const tokenPreview = existingEnv['NOTION_TOKEN']!.slice(0, 12) + '...';
    const pageIdVal = existingEnv['NOTION_PARENT_PAGE_ID']!;
    console.log(`Existing credentials found in ${envPath}:`);
    console.log(`  NOTION_TOKEN:          ${tokenPreview}`);
    console.log(`  NOTION_PARENT_PAGE_ID: ${pageIdVal}\n`);

    const overwrite = await promptVisible('Overwrite with new credentials? [y/N]: ');
    if (!overwrite.toLowerCase().startsWith('y')) {
      console.log('\nKeeping existing credentials.\n');
      // Load from existing env into process.env for the registration step
      process.env.NOTION_TOKEN = existingEnv['NOTION_TOKEN'];
      process.env.NOTION_PARENT_PAGE_ID = existingEnv['NOTION_PARENT_PAGE_ID'];
      token = process.env.NOTION_TOKEN!;
      pageId = process.env.NOTION_PARENT_PAGE_ID!;
    } else {
      token = await collectAndSaveCredentials(envPath, existingEnv);
      pageId = process.env.NOTION_PARENT_PAGE_ID!;
    }
  } else {
    if (envExists) {
      console.log(`Found ${envPath} — credentials are missing or empty. Let\'s fill them in.\n`);
    } else {
      console.log(`No .env found at ${envPath}. Let\'s create it now.\n`);
    }
    token = await collectAndSaveCredentials(envPath, existingEnv);
    pageId = process.env.NOTION_PARENT_PAGE_ID!;
  }

  const tokenPreview = token.slice(0, 12) + '...';
  console.log(`\n✅ Credentials saved to ${envPath}`);
  console.log(`   NOTION_TOKEN:          ${tokenPreview}`);
  console.log(`   NOTION_PARENT_PAGE_ID: ${pageId}\n`);

  // Auto-register with Claude Code
  console.log('Registering MCP server with Claude Code...');
  if (claudeAvailable()) {
    const reg = await registerMcpServer('user');
    if (reg.success) {
      console.log(`✅ MCP server registered (--scope user): ${reg.message}`);
      console.log('\nNext steps:');
      console.log('  1. Restart Claude Code (or reload the window)');
      console.log('  2. Run /mcp in Claude — you should see notion-tdd-agent listed');
      console.log('  3. Run: npx notion-tdd-agent doctor   to verify the full setup\n');
    } else {
      console.log(`⚠  Auto-registration failed: ${reg.message}`);
      console.log('   Run manually:');
      console.log('   npx notion-tdd-agent register\n');
    }
  } else {
    console.log('⚠  Claude Code CLI not found — skipping auto-registration.');
    console.log('   Install Claude Code, then run:');
    console.log('   npx notion-tdd-agent register\n');
  }

  console.log('Verify your setup:');
  console.log('  npx notion-tdd-agent doctor\n');
}

async function collectAndSaveCredentials(
  envPath: string,
  existing: Record<string, string>
): Promise<string> {
  console.log('Step 1 — Notion Integration Token');
  console.log('  Get it from: https://app.notion.com/developers/connections');
  console.log('  Click "+ New connection" → Authentication method: Access token → Create');
  console.log('  Token starts with  secret_  or  ntn_\n');

  let token = '';
  while (!token) {
    token = await promptSecret('  NOTION_TOKEN (hidden): ');
    if (!token) console.log('  Token cannot be empty — try again.');
  }

  console.log('\nStep 2 — Notion Parent Page ID');
  console.log('  Open (or create) a Notion page for your TDDs, e.g. "Technical Design Documents"');
  console.log('  Click … → Connections → toggle on your integration');
  console.log('  Copy the 32-char ID from the page URL (last segment after the final -)');
  console.log('  Or paste the full Notion URL — the ID will be extracted automatically.\n');

  let pageId = '';
  while (!pageId) {
    const raw = await promptVisible('  NOTION_PARENT_PAGE_ID (or URL): ');
    if (!raw) {
      console.log('  Page ID cannot be empty — try again.');
      continue;
    }
    // Extract from URL if needed
    const { parseNotionPageUrl } = await import('./utils/validation.js');
    const extracted = parseNotionPageUrl(raw);
    pageId = (extracted ?? raw.trim()).replace(/-/g, '');
    if (!/^[a-f0-9]{32}$/i.test(pageId)) {
      console.log(`  Could not parse a valid page ID from "${raw}". Paste the 32-char hex or the full Notion URL.`);
      pageId = '';
    }
  }

  // Step 3 — Visual generation
  console.log('\nStep 3 — Visual / Image Generation');
  console.log('  System Overview documents can include generated visuals.');
  console.log('  Default (auto): Mermaid/SVG diagrams and image prompts — no API key required.');
  console.log('  Add OPENAI_API_KEY to your .env to upgrade to OpenAI DALL-E 3 real bitmap images.');
  console.log('  You can always change this later in .env.\n');

  const enableVisuals = await promptVisible('  Enable visual generation? [Y/n]: ');
  const visualEnabled = !enableVisuals.toLowerCase().startsWith('n');

  let imageProvider = 'auto';
  let openAiKey = '';
  let qualityMode = 'polished';

  if (visualEnabled) {
    console.log('\n  Image provider options:');
    console.log('    auto   — (default) Mermaid/SVG diagrams; upgrades to OpenAI DALL-E 3 if OPENAI_API_KEY is set');
    console.log('    claude — Mermaid/SVG diagrams and image prompts only — no API key required');
    console.log('    openai — OpenAI DALL-E 3 bitmap images (requires OPENAI_API_KEY, may incur charges)');
    console.log('    none   — minimal placeholders only\n');

    const providerInput = await promptVisible('  IMAGE_PROVIDER [auto/claude/openai/none] (auto): ');
    const providerChoice = providerInput.toLowerCase().trim();
    if (['auto', 'openai', 'claude', 'none'].includes(providerChoice)) {
      imageProvider = providerChoice;
    } else if (providerChoice !== '') {
      console.log(`  Unknown provider "${providerChoice}" — defaulting to auto.`);
    }

    if (imageProvider === 'openai' || imageProvider === 'auto') {
      const configureNow = await promptVisible('  Configure OpenAI API key now? [y/N]: ');
      if (configureNow.toLowerCase().startsWith('y')) {
        openAiKey = await promptSecret('  OPENAI_API_KEY (hidden): ');
        if (!openAiKey) {
          console.log('  No key entered — skipping. Add OPENAI_API_KEY to .env later to enable OpenAI images.');
        }
      } else {
        console.log('  Skipping OpenAI key — Claude diagrams will be used until a key is added.');
      }
    }

    const draftDefault = await promptVisible('  Default document quality mode? [polished/draft] (polished): ');
    qualityMode = draftDefault.toLowerCase() === 'draft' ? 'draft' : 'polished';
  }

  // Merge into existing env
  const vars: Record<string, string> = {
    ...existing,
    NOTION_TOKEN: token.trim(),
    NOTION_PARENT_PAGE_ID: pageId,
    NOTION_VERSION: existing['NOTION_VERSION'] ?? '2022-06-28',
    GENERATED_FILES_DIR: existing['GENERATED_FILES_DIR'] ?? 'generated',
    LOG_LEVEL: existing['LOG_LEVEL'] ?? 'info',
    VISUAL_GENERATION_ENABLED: visualEnabled ? 'true' : 'false',
    IMAGE_PROVIDER: imageProvider,
    DOCUMENT_QUALITY_MODE: qualityMode,
  };
  if (openAiKey) vars['OPENAI_API_KEY'] = openAiKey;

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
  await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf-8');

  // Expose to process.env for the rest of the current invocation
  process.env.NOTION_TOKEN = token.trim();
  process.env.NOTION_PARENT_PAGE_ID = pageId;

  return token.trim();
}

async function runRegister(): Promise<void> {
  const scope = getFlag('--scope', '-s') ?? 'user';
  const validScopes = ['user', 'project', 'local'];
  if (!validScopes.includes(scope)) {
    console.error(`Invalid scope "${scope}". Must be one of: ${validScopes.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n=== Notion TDD Agent — Register MCP Server (scope: ${scope}) ===\n`);

  const status = checkAuthStatus();
  if (!status.ok) {
    console.error(`Missing credentials: ${status.missing.join(', ')}`);
    console.error('Run  npx notion-tdd-agent init  first.');
    process.exit(1);
  }

  if (!claudeAvailable()) {
    console.error('Claude Code CLI not found. Install Claude Code first.');
    console.error('Then re-run:  npx notion-tdd-agent register');
    process.exit(1);
  }

  const reg = await registerMcpServer(scope);

  if (reg.success) {
    const token = process.env.NOTION_TOKEN!;
    const pageId = process.env.NOTION_PARENT_PAGE_ID!;
    console.log(`✅ notion-tdd-agent registered with Claude Code (--scope ${scope})`);
    console.log(`   Command used:`);
    console.log(
      `   claude mcp add-json --scope ${scope} notion-tdd-agent ` +
      `'{"type":"stdio","command":"npx","args":["notion-tdd-agent","server"],"env":{` +
      `"NOTION_TOKEN":"${token.slice(0, 8)}...","NOTION_PARENT_PAGE_ID":"${pageId}"}}'`
    );
    console.log('\nNext steps:');
    console.log('  1. Restart Claude Code (or reload the window)');
    console.log('  2. Run /mcp in Claude — look for notion-tdd-agent in the list\n');
  } else {
    console.error(`❌ Registration failed: ${reg.message}`);
    console.error('\nManual fallback — add to ~/.claude/settings.json:');
    const token = process.env.NOTION_TOKEN ?? '';
    const pageId = process.env.NOTION_PARENT_PAGE_ID ?? '';
    console.error(JSON.stringify({
      mcpServers: {
        'notion-tdd-agent': {
          command: 'npx',
          args: ['notion-tdd-agent', 'server'],
          env: { NOTION_TOKEN: token, NOTION_PARENT_PAGE_ID: pageId },
        },
      },
    }, null, 2));
    process.exit(1);
  }
}

async function runDoctor(): Promise<void> {
  const envPath = path.resolve(process.cwd(), '.env');
  let allPassed = true;

  function pass(msg: string): void { console.log(`  ✅ ${msg}`); }
  function warn(msg: string, fix?: string): void {
    console.log(`  ⚠  ${msg}`);
    if (fix) console.log(`     → ${fix}`);
  }
  function fail(msg: string, fix?: string): void {
    console.log(`  ❌ ${msg}`);
    if (fix) console.log(`     Fix: ${fix}`);
    allPassed = false;
  }

  console.log('\n=== Notion TDD Agent — Doctor ===\n');

  // Node.js version
  const nodeVersion = process.versions.node;
  const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);
  if (nodeMajor >= 18) {
    pass(`Node.js ${nodeVersion}`);
  } else {
    fail(`Node.js ${nodeVersion} — requires ≥ 18`, 'Upgrade at https://nodejs.org');
  }

  // .env file
  try {
    await fs.access(envPath);
    pass(`.env found (${envPath})`);
  } catch {
    fail('.env not found', 'Run  npx notion-tdd-agent init  to create it');
  }

  // Credentials
  const status = checkAuthStatus();
  if (status.hasToken) {
    pass('NOTION_TOKEN configured');
  } else {
    fail('NOTION_TOKEN missing', `Open ${envPath} and add NOTION_TOKEN=your_integration_secret`);
  }

  if (status.hasPageId) {
    pass('NOTION_PARENT_PAGE_ID configured');
  } else {
    fail('NOTION_PARENT_PAGE_ID missing', `Open ${envPath} and add NOTION_PARENT_PAGE_ID=your_32_char_page_id`);
  }

  if (!status.ok) {
    console.log('\nFix the issues above then run  npx notion-tdd-agent doctor  again.\n');
    process.exit(1);
  }

  // Notion API reachable
  try {
    const { searchNotionPages } = await import('./notion/notionTools.js');
    await searchNotionPages('', 1);
    pass('Notion API reachable');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('401') || msg.includes('Authentication') || msg.includes('Unauthorized')) {
      fail('Notion API authentication failed', 'Re-copy NOTION_TOKEN from app.notion.com/developers/connections');
    } else {
      fail(`Notion API error: ${msg}`);
    }
    process.exit(1);
  }

  // Parent page accessible
  try {
    const { getNotionClient } = await import('./notion/notionClient.js');
    const client = getNotionClient();
    const pageId = process.env.NOTION_PARENT_PAGE_ID!;
    await client.pages.retrieve({ page_id: pageId });
    pass('Parent page accessible');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('404') || msg.includes('not_found') || msg.includes('Could not find')) {
      fail(
        'Parent page not accessible',
        'Open the Notion page → Connections → toggle on your integration. Verify NOTION_PARENT_PAGE_ID is correct.'
      );
    } else {
      fail(`Parent page error: ${msg}`);
    }
    process.exit(1);
  }

  // Visual generation config
  const visualEnabled = (process.env.VISUAL_GENERATION_ENABLED ?? 'true') !== 'false';
  const imageProvider = (process.env.IMAGE_PROVIDER ?? 'auto').toLowerCase();
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const qualityMode = process.env.DOCUMENT_QUALITY_MODE ?? 'polished';

  // Resolve detected provider using same logic as getVisualConfig()
  let detectedProvider: string;
  if (imageProvider === 'auto') {
    detectedProvider = hasOpenAiKey ? 'openai' : 'claude';
  } else if (imageProvider === 'openai') {
    detectedProvider = hasOpenAiKey ? 'openai' : 'none';
  } else if (imageProvider === 'claude') {
    detectedProvider = 'claude';
  } else if (imageProvider === 'none') {
    detectedProvider = 'none';
  } else {
    detectedProvider = 'none';
  }
  const bitmapAvailable = visualEnabled && qualityMode !== 'draft' && detectedProvider === 'openai';

  if (!visualEnabled) {
    pass(`Visual generation disabled (VISUAL_GENERATION_ENABLED=false) — Mermaid diagrams and placeholders only`);
  } else if (qualityMode === 'draft') {
    pass(`Visual generation enabled — quality mode: draft (Mermaid/placeholders only, images skipped)`);
  } else {
    pass(`Visual generation enabled — quality mode: ${qualityMode}`);
    pass(`Image provider: ${imageProvider} → active: ${detectedProvider}`);

    if (bitmapAvailable) {
      pass(`OpenAI DALL-E 3 bitmap generation active`);
      console.log(`  → Real bitmap images will be generated via OpenAI`);
    } else if (detectedProvider === 'claude') {
      pass(`Claude visual path active — Mermaid/SVG diagrams and image prompts (no API key required)`);
      console.log(`  → Diagrams and image prompts will be generated by Claude`);
      if (imageProvider === 'auto') {
        console.log(`  → To enable OpenAI bitmap images: add OPENAI_API_KEY to ${envPath}`);
      }
    } else if (imageProvider === 'openai' && !hasOpenAiKey) {
      warn(
        `IMAGE_PROVIDER=openai but OPENAI_API_KEY is missing`,
        `Add OPENAI_API_KEY to ${envPath}, or change IMAGE_PROVIDER=auto to use the default path.`,
      );
      console.log(`  → Falling back to Mermaid/SVG diagrams and placeholder prompts`);
    } else {
      warn(
        `Image provider "${imageProvider}" is not supported`,
        `Supported values: auto (default), claude, openai, none.`,
      );
      console.log(`  → Fallback: Mermaid/SVG diagrams and placeholder prompts`);
    }
  }

  // Claude Code CLI
  const hasClaude = claudeAvailable();
  if (hasClaude) {
    pass('Claude Code CLI available');
  } else {
    warn('Claude Code CLI not found', 'Install Claude Code from https://claude.ai/download');
  }

  // MCP registration
  if (hasClaude) {
    if (mcpRegistered('notion-tdd-agent')) {
      pass('notion-tdd-agent registered in Claude Code');
    } else {
      warn(
        'notion-tdd-agent not registered in Claude Code',
        'Run:  npx notion-tdd-agent register'
      );
    }
  }

  if (allPassed) {
    console.log('\nAll checks passed. Ready to create TDDs.\n');
  } else {
    console.log('\nSome checks failed — see fixes above.\n');
    process.exit(1);
  }
}

function runConfig(): void {
  console.log('\n=== Notion TDD Agent — Config ===\n');
  const token = process.env.NOTION_TOKEN;
  const pageId = process.env.NOTION_PARENT_PAGE_ID;
  const version = process.env.NOTION_VERSION ?? '2022-06-28 (default)';
  const logLevel = process.env.LOG_LEVEL ?? 'info (default)';
  const filesDir = process.env.GENERATED_FILES_DIR ?? 'generated (default)';
  const visualEnabled = process.env.VISUAL_GENERATION_ENABLED ?? 'true (default)';
  const imageProvider = process.env.IMAGE_PROVIDER ?? 'auto (default)';
  const openAiKey = process.env.OPENAI_API_KEY;
  const qualityMode = process.env.DOCUMENT_QUALITY_MODE ?? 'polished (default)';

  console.log(`NOTION_TOKEN:               ${token ? token.slice(0, 12) + '...' : '(not set)'}`);
  console.log(`NOTION_PARENT_PAGE_ID:      ${pageId ?? '(not set)'}`);
  console.log(`NOTION_VERSION:             ${version}`);
  console.log(`LOG_LEVEL:                  ${logLevel}`);
  console.log(`GENERATED_FILES_DIR:        ${filesDir}`);
  console.log('');
  console.log(`VISUAL_GENERATION_ENABLED:  ${visualEnabled}`);
  console.log(`IMAGE_PROVIDER:             ${imageProvider}`);
  console.log(`OPENAI_API_KEY:             ${openAiKey ? openAiKey.slice(0, 8) + '...' : '(not set)'}`);
  console.log(`DOCUMENT_QUALITY_MODE:      ${qualityMode}`);
  console.log('');
}

function runHelp(): void {
  console.log(`
Notion TDD Agent — MCP server for Technical Design Documents in Notion

Usage:
  npx notion-tdd-agent <command> [options]

Commands:
  init                  Interactive setup — collect credentials, save .env, register MCP
  register              Register MCP server with Claude Code (uses existing .env)
  doctor                Check credentials, Notion connection, and Claude Code registration
  server                Start the MCP server (used by Claude Code / Claude Desktop)
  config                Show current configuration
  help                  Show this help message

Options for register:
  --scope <scope>       Registration scope: user (default), project, local
  -s <scope>            Shorthand for --scope

Quick start:
  npx notion-tdd-agent init          # interactive setup + auto-register
  npx notion-tdd-agent doctor        # verify everything works
  # restart Claude Code, then run /mcp to confirm notion-tdd-agent appears

Manual registration:
  npx notion-tdd-agent register                   # register for current user (recommended)
  npx notion-tdd-agent register --scope project   # register for this project only
  npx notion-tdd-agent register --scope local     # register locally (not committed)

Visual generation (.env):
  VISUAL_GENERATION_ENABLED=true        # default — enables image generation for polished docs
  VISUAL_GENERATION_ENABLED=false       # faster drafts — Mermaid diagrams + placeholders only
  IMAGE_PROVIDER=auto                   # auto (default) | claude | openai | none
  OPENAI_API_KEY=sk-...                 # optional — required only for IMAGE_PROVIDER=openai or auto
  DOCUMENT_QUALITY_MODE=polished        # default — generate visuals when configured
  DOCUMENT_QUALITY_MODE=draft           # skip image generation, compact output
`);
}

// ─── Command dispatch ────────────────────────────────────────────────────────

switch (command) {
  case 'server':
    await import('./index.js');
    break;

  case 'init':
    await runInit();
    break;

  case 'register':
    await runRegister();
    break;

  case 'doctor':
    await runDoctor();
    break;

  case 'config':
    runConfig();
    break;

  case 'help':
  case '--help':
  case '-h':
    runHelp();
    break;

  default:
    console.error(`Unknown command: "${command}"`);
    console.error('Run  npx notion-tdd-agent help  for usage.');
    process.exit(1);
}
