import { Client } from '@notionhq/client';
import { logger } from '../utils/logger.js';

let _client: Client | null = null;

export function getNotionClient(): Client {
  if (_client) return _client;

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error(
      '[notion-client] NOTION_TOKEN environment variable is required.\n' +
        'Set it in .env or your shell before starting the server.\n' +
        'See .env.example for all required variables.'
    );
  }

  _client = new Client({
    auth: token,
    notionVersion: (process.env.NOTION_VERSION ?? '2022-06-28') as '2022-06-28',
  });

  logger.info('Notion client initialized');
  return _client;
}

// Call this after updating NOTION_TOKEN via notion_save_credentials so the
// cached client is rebuilt with the new token on the next API call.
export function resetNotionClient(): void {
  _client = null;
  logger.info('Notion client reset — will reinitialize on next call');
}
