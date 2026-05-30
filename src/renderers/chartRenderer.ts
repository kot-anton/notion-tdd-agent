import {
  tableBlock,
  paragraphBlock,
  heading3Block,
  type NotionBlock,
} from '../notion/notionBlocks.js';

export interface ChartData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export function chartToNotionBlocks(data: ChartData): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  if (data.caption) {
    blocks.push(heading3Block(data.caption));
  }
  blocks.push(tableBlock(data.headers, data.rows));
  return blocks;
}

// Pre-built table generators for common TDD sections

export function risksTable(
  risks: Array<{
    risk: string;
    likelihood: 'Low' | 'Medium' | 'High';
    impact: 'Low' | 'Medium' | 'High';
    mitigation: string;
  }>
): NotionBlock[] {
  return chartToNotionBlocks({
    caption: 'Risk Register',
    headers: ['Risk', 'Likelihood', 'Impact', 'Mitigation'],
    rows: risks.map((r) => [r.risk, r.likelihood, r.impact, r.mitigation]),
  });
}

export function dependenciesTable(
  deps: Array<{
    name: string;
    owner: string;
    type: string;
    notes: string;
  }>
): NotionBlock[] {
  return chartToNotionBlocks({
    caption: 'Dependencies',
    headers: ['Dependency', 'Owner', 'Type', 'Notes'],
    rows: deps.map((d) => [d.name, d.owner, d.type, d.notes]),
  });
}

export function apiContractTable(
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
    auth: string;
  }>
): NotionBlock[] {
  return chartToNotionBlocks({
    caption: 'API Contract',
    headers: ['Method', 'Path', 'Description', 'Auth'],
    rows: endpoints.map((e) => [e.method, e.path, e.description, e.auth]),
  });
}

export function rolloutTable(
  phases: Array<{
    phase: string;
    scope: string;
    duration: string;
    rollbackTrigger: string;
  }>
): NotionBlock[] {
  return chartToNotionBlocks({
    caption: 'Rollout Plan',
    headers: ['Phase', 'Scope', 'Duration', 'Rollback Trigger'],
    rows: phases.map((p) => [p.phase, p.scope, p.duration, p.rollbackTrigger]),
  });
}

export function testCoverageTable(
  coverage: Array<{
    area: string;
    type: string;
    tool: string;
    owner: string;
  }>
): NotionBlock[] {
  return chartToNotionBlocks({
    caption: 'Test Coverage Plan',
    headers: ['Area', 'Test Type', 'Tool', 'Owner'],
    rows: coverage.map((c) => [c.area, c.type, c.tool, c.owner]),
  });
}

export { paragraphBlock };
