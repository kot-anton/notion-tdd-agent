import type { NotionBlock } from '../notion/notionBlocks.js';
import {
  heading2Block,
  paragraphBlock,
  bulletedListItem,
  todoBlock,
  dividerBlock,
  calloutBlock,
  toggleBlock,
  tableBlock,
  tableOfContentsBlock,
} from '../notion/notionBlocks.js';
import type { DesignTemplateType } from './designSchema.js';

export interface DesignTemplateOptions {
  title: string;
  owner: string;
  context?: string;
}

export interface DesignTemplate {
  type: DesignTemplateType;
  name: string;
  icon: string;
  description: string;
  buildBlocks(options: DesignTemplateOptions): NotionBlock[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionHeader(text: string): NotionBlock[] {
  return [heading2Block(text), dividerBlock()];
}

function stubParagraph(text: string): NotionBlock {
  return paragraphBlock(text);
}

// ─── Templates ────────────────────────────────────────────────────────────────

const productBrief: DesignTemplate = {
  type: 'product_brief',
  name: 'Product Brief',
  icon: '📋',
  description: 'Product requirement doc with problem, solution, user stories, and metrics.',
  buildBlocks({ owner, context }) {
    return [
      calloutBlock(
        `Owner: ${owner}${context ? ` · ${context}` : ''} · Status: Draft`,
        '📋',
        'blue_background'
      ),
      tableOfContentsBlock(),
      dividerBlock(),
      ...sectionHeader('Problem Statement'),
      stubParagraph('Describe the user problem or business opportunity this addresses.'),
      ...sectionHeader('Target Users'),
      stubParagraph('Who are the primary users? Add personas, segments, or job titles.'),
      bulletedListItem('Primary persona: …'),
      bulletedListItem('Secondary persona: …'),
      ...sectionHeader('Proposed Solution'),
      stubParagraph('High-level description of the solution and why this approach was chosen.'),
      ...sectionHeader('User Stories'),
      bulletedListItem('As a [user], I want to [action] so that [outcome].'),
      bulletedListItem('As a [user], I want to [action] so that [outcome].'),
      bulletedListItem('As a [user], I want to [action] so that [outcome].'),
      ...sectionHeader('Success Metrics'),
      tableBlock(
        ['Metric', 'Baseline', 'Target', 'Measurement Method'],
        [
          ['', '', '', ''],
          ['', '', '', ''],
        ]
      ),
      ...sectionHeader('Out of Scope'),
      stubParagraph('Explicitly list what is NOT included in this release.'),
      ...sectionHeader('Timeline & Milestones'),
      tableBlock(
        ['Phase', 'Description', 'Owner', 'Target Date'],
        [
          ['Discovery', '', owner, ''],
          ['Design', '', owner, ''],
          ['Build', '', owner, ''],
          ['Launch', '', owner, ''],
        ]
      ),
      ...sectionHeader('Open Questions'),
      todoBlock('Question 1 — Owner: @name'),
      todoBlock('Question 2 — Owner: @name'),
    ];
  },
};

const meetingNotes: DesignTemplate = {
  type: 'meeting_notes',
  name: 'Meeting Notes',
  icon: '📅',
  description: 'Meeting agenda, discussion, decisions, and action items.',
  buildBlocks({ owner, context }) {
    const today = new Date().toISOString().split('T')[0];
    return [
      calloutBlock(
        `Date: ${today} · Facilitator: ${owner}${context ? ` · ${context}` : ''}`,
        '📅',
        'gray_background'
      ),
      dividerBlock(),
      ...sectionHeader('Attendees'),
      tableBlock(
        ['Name', 'Role', 'Status'],
        [
          [owner, '', '✅ Present'],
          ['', '', ''],
          ['', '', ''],
        ]
      ),
      ...sectionHeader('Agenda'),
      bulletedListItem('Topic 1 (5 min)'),
      bulletedListItem('Topic 2 (10 min)'),
      bulletedListItem('Topic 3 (10 min)'),
      ...sectionHeader('Discussion Notes'),
      stubParagraph('Capture key points, context, and any important information shared.'),
      ...sectionHeader('Decisions Made'),
      bulletedListItem('Decision 1: …'),
      bulletedListItem('Decision 2: …'),
      ...sectionHeader('Action Items'),
      todoBlock('Action item 1 — Owner: @name — Due: '),
      todoBlock('Action item 2 — Owner: @name — Due: '),
      todoBlock('Action item 3 — Owner: @name — Due: '),
      ...sectionHeader('Next Meeting'),
      stubParagraph('Date / time / recurring cadence for the next sync.'),
    ];
  },
};

const projectRoadmap: DesignTemplate = {
  type: 'project_roadmap',
  name: 'Project Roadmap',
  icon: '🗺️',
  description: 'Phased project plan with milestones, owners, and status tracking.',
  buildBlocks({ owner, context }) {
    return [
      calloutBlock(
        `Owner: ${owner} · Status: Active${context ? ` · ${context}` : ''}`,
        '🗺️',
        'green_background'
      ),
      tableOfContentsBlock(),
      dividerBlock(),
      ...sectionHeader('Overview'),
      stubParagraph('What is this project and what outcome does it deliver?'),
      ...sectionHeader('Phase 1 — Discovery'),
      tableBlock(
        ['Task', 'Owner', 'Status', 'Due Date'],
        [
          ['Define requirements', owner, '🔲 Not started', ''],
          ['User research', '', '🔲 Not started', ''],
          ['Competitive analysis', '', '🔲 Not started', ''],
        ]
      ),
      ...sectionHeader('Phase 2 — Design & Build'),
      tableBlock(
        ['Task', 'Owner', 'Status', 'Due Date'],
        [
          ['Architecture design', owner, '🔲 Not started', ''],
          ['Implementation', '', '🔲 Not started', ''],
          ['Internal testing', '', '🔲 Not started', ''],
        ]
      ),
      ...sectionHeader('Phase 3 — Launch'),
      tableBlock(
        ['Task', 'Owner', 'Status', 'Due Date'],
        [
          ['Stakeholder review', owner, '🔲 Not started', ''],
          ['Beta release', '', '🔲 Not started', ''],
          ['Full rollout', '', '🔲 Not started', ''],
        ]
      ),
      ...sectionHeader('Key Milestones'),
      tableBlock(
        ['Milestone', 'Target Date', 'Status'],
        [
          ['Discovery complete', '', '🔲'],
          ['Build complete', '', '🔲'],
          ['Launch', '', '🔲'],
        ]
      ),
      ...sectionHeader('Risks & Blockers'),
      tableBlock(
        ['Risk', 'Likelihood', 'Impact', 'Mitigation'],
        [
          ['', 'Medium', 'High', ''],
          ['', 'Low', 'Medium', ''],
        ]
      ),
    ];
  },
};

const designSpec: DesignTemplate = {
  type: 'design_spec',
  name: 'Design Specification',
  icon: '🎨',
  description: 'UX and product design spec with user flows, component specs, and design decisions.',
  buildBlocks({ owner, context }) {
    return [
      calloutBlock(
        `Design Spec · Owner: ${owner}${context ? ` · ${context}` : ''} · Status: Draft`,
        '🎨',
        'purple_background'
      ),
      tableOfContentsBlock(),
      dividerBlock(),
      ...sectionHeader('Overview'),
      stubParagraph('What experience or feature is being designed? Provide context and goals.'),
      ...sectionHeader('User Flows'),
      stubParagraph('Describe the primary user journey step by step.'),
      bulletedListItem('Step 1: User lands on …'),
      bulletedListItem('Step 2: User selects …'),
      bulletedListItem('Step 3: System responds with …'),
      calloutBlock(
        'Tip: Use tdd_generate_mermaid_diagram with type "flowchart" or "sequence" to add a visual flow diagram.',
        '💡',
        'yellow_background'
      ),
      ...sectionHeader('Component Specifications'),
      tableBlock(
        ['Component', 'Description', 'States', 'Interactions'],
        [
          ['', '', 'default, hover, active, disabled', ''],
          ['', '', '', ''],
        ]
      ),
      ...sectionHeader('Design Decisions'),
      toggleBlock('Decision 1: [Topic]', [
        paragraphBlock('Context: Why did this decision need to be made?'),
        paragraphBlock('Options considered: …'),
        paragraphBlock('Decision: …'),
        paragraphBlock('Rationale: …'),
      ]),
      toggleBlock('Decision 2: [Topic]', [
        paragraphBlock('Context: …'),
        paragraphBlock('Decision: …'),
      ]),
      ...sectionHeader('Accessibility Notes'),
      bulletedListItem('Keyboard navigation: …'),
      bulletedListItem('Screen reader labels: …'),
      bulletedListItem('Color contrast: meets WCAG AA minimum (4.5:1)'),
      ...sectionHeader('Assets & Links'),
      bulletedListItem('Figma: [link]'),
      bulletedListItem('Prototype: [link]'),
      bulletedListItem('Design system: [link]'),
    ];
  },
};

const changelog: DesignTemplate = {
  type: 'changelog',
  name: 'Changelog',
  icon: '📦',
  description: 'Versioned release log with features, bug fixes, and breaking changes.',
  buildBlocks({ owner, context }) {
    return [
      calloutBlock(
        `Maintained by: ${owner}${context ? ` · ${context}` : ''}`,
        '📦',
        'green_background'
      ),
      dividerBlock(),
      ...sectionHeader('Unreleased'),
      calloutBlock('Changes staged for the next release go here.', '🚧', 'yellow_background'),
      toggleBlock('✨ Features', [
        bulletedListItem('Add [feature name] — PR #'),
      ]),
      toggleBlock('🐛 Bug Fixes', [
        bulletedListItem('Fix [issue description] — PR #'),
      ]),
      toggleBlock('💥 Breaking Changes', [
        bulletedListItem('None'),
      ]),
      dividerBlock(),
      ...sectionHeader('Version History'),
      tableBlock(
        ['Version', 'Release Date', 'Summary'],
        [
          ['v1.0.0', '', 'Initial release'],
        ]
      ),
      dividerBlock(),
      heading2Block('v1.0.0 — [Date]'),
      toggleBlock('✨ Features', [
        bulletedListItem('Initial release'),
      ]),
      toggleBlock('🐛 Bug Fixes', [
        bulletedListItem('None'),
      ]),
    ];
  },
};

const onboardingGuide: DesignTemplate = {
  type: 'onboarding_guide',
  name: 'Onboarding Guide',
  icon: '👋',
  description: 'Team or product onboarding with setup steps, contacts, and key resources.',
  buildBlocks({ owner, context }) {
    return [
      calloutBlock(
        `Welcome! This guide was prepared by ${owner}.${context ? ` ${context}` : ''} Last updated: ${new Date().toISOString().split('T')[0]}`,
        '👋',
        'yellow_background'
      ),
      tableOfContentsBlock(),
      dividerBlock(),
      ...sectionHeader('Prerequisites'),
      bulletedListItem('Access to [tool/system] — request via [link/channel]'),
      bulletedListItem('Installed: [tool 1], [tool 2]'),
      bulletedListItem('Read: [document link]'),
      ...sectionHeader('Environment Setup'),
      bulletedListItem('Step 1: Clone the repo — git clone [url]'),
      bulletedListItem('Step 2: Install dependencies — npm install'),
      bulletedListItem('Step 3: Copy .env.example to .env and fill in values'),
      bulletedListItem('Step 4: Run npm run dev to start the local server'),
      calloutBlock('If you hit issues during setup, ping @[team-handle] in #[channel].', '🛟', 'blue_background'),
      ...sectionHeader('First Steps'),
      todoBlock('Complete environment setup'),
      todoBlock('Read the architecture overview doc'),
      todoBlock('Complete your first task: [task description]'),
      todoBlock('Attend your first team standup'),
      ...sectionHeader('Team Contacts'),
      tableBlock(
        ['Name', 'Role', 'Slack / Email', 'Timezone'],
        [
          [owner, 'Guide Author', '', ''],
          ['', 'Engineering Lead', '', ''],
          ['', 'Product Manager', '', ''],
        ]
      ),
      ...sectionHeader('Key Resources'),
      bulletedListItem('Architecture doc: [link]'),
      bulletedListItem('Runbook: [link]'),
      bulletedListItem('Design system: [link]'),
      bulletedListItem('Issue tracker: [link]'),
      bulletedListItem('Slack workspace: [link]'),
      ...sectionHeader('FAQ'),
      toggleBlock('How do I request access to [system]?', [
        paragraphBlock('Go to [link] and submit a request. Approval takes ~1 business day.'),
      ]),
      toggleBlock('Where are the deployment instructions?', [
        paragraphBlock('See the Runbook (linked above) → Deployment section.'),
      ]),
    ];
  },
};

const runbook: DesignTemplate = {
  type: 'runbook',
  name: 'Runbook',
  icon: '🚨',
  description: 'Operational runbook with alert triggers, diagnosis steps, and escalation policy.',
  buildBlocks({ owner, context }) {
    return [
      calloutBlock(
        `Runbook · Owner: ${owner}${context ? ` · Service: ${context}` : ''} · Updated: ${new Date().toISOString().split('T')[0]}`,
        '🚨',
        'red_background'
      ),
      tableOfContentsBlock(),
      dividerBlock(),
      ...sectionHeader('Service Overview'),
      tableBlock(
        ['Property', 'Value'],
        [
          ['Service name', context ?? ''],
          ['Owner', owner],
          ['On-call rotation', ''],
          ['SLA', ''],
          ['Dashboard link', ''],
          ['Logs link', ''],
        ]
      ),
      ...sectionHeader('Alert Triggers'),
      tableBlock(
        ['Alert Name', 'Condition', 'Severity', 'First Action'],
        [
          ['High error rate', 'error_rate > 1%', 'P1', 'Check logs'],
          ['High latency', 'p99 > 2s', 'P2', 'Check DB queries'],
          ['Service down', 'health check failing', 'P0', 'Restart pod'],
        ]
      ),
      ...sectionHeader('Diagnosis Steps'),
      bulletedListItem('1. Check the service dashboard for anomalies'),
      bulletedListItem('2. Inspect recent logs for errors: [log query link]'),
      bulletedListItem('3. Check downstream dependencies for failures'),
      bulletedListItem('4. Review recent deployments in CI/CD'),
      calloutBlock(
        'For P0 incidents: page the on-call engineer immediately and open a war room in #incidents.',
        '⚡',
        'red_background'
      ),
      ...sectionHeader('Resolution Procedures'),
      toggleBlock('High error rate', [
        bulletedListItem('1. Identify the error class in logs'),
        bulletedListItem('2. Check if a recent deploy introduced the regression'),
        bulletedListItem('3. Roll back the deploy if confirmed'),
        bulletedListItem('4. File an incident follow-up TDD'),
      ]),
      toggleBlock('Service restart', [
        bulletedListItem('1. kubectl rollout restart deployment/[service-name]'),
        bulletedListItem('2. Watch rollout: kubectl rollout status deployment/[service-name]'),
        bulletedListItem('3. Confirm health check recovers within 2 minutes'),
      ]),
      ...sectionHeader('Escalation Policy'),
      tableBlock(
        ['Step', 'Who', 'How', 'When'],
        [
          ['1', 'On-call engineer', 'PagerDuty / Slack', 'Immediately on P0/P1'],
          ['2', 'Team lead', 'Direct Slack DM', 'If unresolved after 15 min'],
          ['3', 'Engineering manager', 'Phone call', 'If unresolved after 30 min'],
        ]
      ),
      ...sectionHeader('Post-Incident Checklist'),
      todoBlock('Incident resolved and service stable'),
      todoBlock('Root cause identified'),
      todoBlock('Stakeholders notified of resolution'),
      todoBlock('Incident TDD created (use tdd_create_document mode=incident_followup)'),
      todoBlock('Follow-up action items tracked in Jira'),
    ];
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const DESIGN_TEMPLATES: Record<DesignTemplateType, DesignTemplate> = {
  product_brief: productBrief,
  meeting_notes: meetingNotes,
  project_roadmap: projectRoadmap,
  design_spec: designSpec,
  changelog,
  onboarding_guide: onboardingGuide,
  runbook,
};

export function getDesignTemplate(type: DesignTemplateType): DesignTemplate {
  return DESIGN_TEMPLATES[type];
}

export function listDesignTemplates(): Array<{
  type: DesignTemplateType;
  name: string;
  icon: string;
  description: string;
}> {
  return Object.values(DESIGN_TEMPLATES).map(({ type, name, icon, description }) => ({
    type,
    name,
    icon,
    description,
  }));
}
