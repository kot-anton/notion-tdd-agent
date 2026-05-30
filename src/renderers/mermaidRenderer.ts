import { execFile } from 'child_process';
import { promisify } from 'util';
import { saveFile } from '../utils/fileStorage.js';
import { logger } from '../utils/logger.js';
import type { DiagramType } from '../tdd/tddSchema.js';

const execFileAsync = promisify(execFile);

export async function detectMmdc(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', ['mmdc']);
    const path = stdout.trim();
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

export function generateMermaidSyntax(
  type: DiagramType,
  description: string,
  title?: string
): string {
  const titleLine = title ? `  title ${title}\n` : '';
  const comment = `  %% ${description}`;

  const templates: Record<DiagramType, string> = {
    flowchart: [
      'flowchart TD',
      titleLine.trim() ? titleLine : '',
      comment,
      '  A([Start]) --> B{Decision Point}',
      '  B -->|Yes| C[Process A]',
      '  B -->|No| D[Process B]',
      '  C --> E([End])',
      '  D --> E',
    ]
      .filter(Boolean)
      .join('\n'),

    sequence: [
      'sequenceDiagram',
      titleLine.trim() ? `  ${titleLine.trim()}` : '',
      comment,
      '  participant Client',
      '  participant Service',
      '  participant Database',
      '',
      '  Client->>+Service: Request',
      '  Service->>+Database: Query',
      '  Database-->>-Service: Result',
      '  Service-->>-Client: Response',
    ]
      .filter(Boolean)
      .join('\n'),

    class: [
      'classDiagram',
      comment,
      '  class Entity {',
      '    +String id',
      '    +String name',
      '    +createdAt DateTime',
      '    +method() void',
      '  }',
      '  class RelatedEntity {',
      '    +String entityId',
      '  }',
      '  Entity "1" --> "*" RelatedEntity',
    ].join('\n'),

    entity_relationship: [
      'erDiagram',
      comment,
      '  ENTITY {',
      '    string id PK',
      '    string name',
      '    timestamp created_at',
      '  }',
      '  RELATED_ENTITY {',
      '    string id PK',
      '    string entity_id FK',
      '  }',
      '  ENTITY ||--o{ RELATED_ENTITY : "has"',
    ].join('\n'),

    state: [
      'stateDiagram-v2',
      titleLine.trim() ? titleLine : '',
      comment,
      '  [*] --> Idle',
      '  Idle --> Processing : trigger',
      '  Processing --> Success : done',
      '  Processing --> Error : failed',
      '  Success --> [*]',
      '  Error --> Idle : retry',
    ]
      .filter(Boolean)
      .join('\n'),

    gantt: [
      `gantt`,
      `  title ${title ?? 'Rollout Plan'}`,
      `  dateFormat YYYY-MM-DD`,
      `  section Phase 1`,
      `  Task 1           :a1, 2026-01-01, 7d`,
      `  Task 2           :a2, after a1, 5d`,
      `  section Phase 2`,
      `  Task 3           :a3, after a2, 10d`,
    ].join('\n'),

    component: [
      'graph LR',
      comment,
      '  subgraph Frontend',
      '    UI[Web App]',
      '  end',
      '  subgraph Backend',
      '    API[API Service]',
      '    Worker[Background Worker]',
      '  end',
      '  subgraph Storage',
      '    DB[(Database)]',
      '    Cache[(Cache)]',
      '  end',
      '  UI --> API',
      '  API --> DB',
      '  API --> Cache',
      '  Worker --> DB',
    ].join('\n'),
  };

  return templates[type] ?? `flowchart TD\n  ${comment}\n  A[Start] --> B[End]`;
}

export interface RenderResult {
  success: boolean;
  filePath: string;
  outputFormat?: string;
  error?: string;
  todoMessage?: string;
}

export async function renderMermaid(
  mmdContent: string,
  outputFormat: 'svg' | 'png' = 'svg',
  filenameHint?: string
): Promise<RenderResult> {
  const basename = filenameHint ?? 'diagram';

  // Always save the .mmd source
  const mmdFilePath = await saveFile(mmdContent, basename, 'mmd', 'diagrams');

  const mmdcPath = await detectMmdc();

  if (!mmdcPath) {
    logger.warn('mmdc not found — .mmd source saved only');
    return {
      success: false,
      filePath: mmdFilePath,
      todoMessage:
        `mmdc (Mermaid CLI) is not installed. To render diagrams:\n` +
        `  npm install -g @mermaid-js/mermaid-cli\n\n` +
        `Then render manually:\n` +
        `  mmdc -i "${mmdFilePath}" -o output.${outputFormat}\n\n` +
        `Raw .mmd source saved at: ${mmdFilePath}`,
    };
  }

  const outputPath = mmdFilePath.replace('.mmd', `.${outputFormat}`);

  try {
    await execFileAsync(mmdcPath, ['-i', mmdFilePath, '-o', outputPath]);
    logger.info('Diagram rendered', { outputPath, format: outputFormat });
    return { success: true, filePath: outputPath, outputFormat };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('mmdc render failed', { error });
    return {
      success: false,
      filePath: mmdFilePath,
      error: `Render failed: ${error}\nSource saved at: ${mmdFilePath}`,
    };
  }
}
