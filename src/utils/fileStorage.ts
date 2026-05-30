import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger.js';

function getBaseDir(): string {
  return process.env.GENERATED_FILES_DIR ?? 'generated';
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export async function saveFile(
  content: string | Buffer,
  basename: string,
  extension: string,
  subdir?: string
): Promise<string> {
  const base = getBaseDir();
  const dir = subdir ? path.join(base, subdir) : base;
  await fs.mkdir(dir, { recursive: true });
  const filename = `${basename}-${timestamp()}.${extension}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, content, typeof content === 'string' ? 'utf-8' : undefined);
  logger.info('Saved file', { path: fullPath });
  return fullPath;
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}
