import type { DocumentMode } from './tddSchema.js';

export interface SectionDefinition {
  id: string;
  heading: string;
  description: string;
  required: boolean;
  defaultContent: string;
}

const ALL_SECTIONS: Record<string, SectionDefinition> = {
  summary: {
    id: 'summary',
    heading: 'Overview',
    description: 'Short explanation of the feature, service, or project.',
    required: true,
    defaultContent:
      '<!-- TODO: Write a 2–4 sentence overview. What is being built, why now, and what outcome it enables. -->',
  },
  problem_context: {
    id: 'problem_context',
    heading: 'Problem / Context',
    description: 'Why this is needed. What problem does this solve?',
    required: true,
    defaultContent:
      '<!-- TODO: Describe the current state and the specific pain it causes. Include data or user feedback if available. -->',
  },
  goals: {
    id: 'goals',
    heading: 'Goals',
    description: 'Measurable success criteria for this change.',
    required: true,
    defaultContent:
      '<!-- TODO: List 3–5 concrete, measurable goals. Use bullet points.\n- [ ] Goal 1\n- [ ] Goal 2 -->',
  },
  non_goals: {
    id: 'non_goals',
    heading: 'Non-Goals',
    description: 'What is explicitly out of scope.',
    required: true,
    defaultContent:
      '<!-- TODO: List what this change will NOT address. This helps prevent scope creep.\n- Not in scope: X\n- Not in scope: Y -->',
  },
  users_actors: {
    id: 'users_actors',
    heading: 'Users / Actors',
    description: 'Who uses or interacts with this system.',
    required: false,
    defaultContent:
      '<!-- TODO: List all users and systems that interact with this feature.\n| Actor | Role | Interaction |\n|---|---|---|\n| End User | ... | ... |\n| Admin | ... | ... |\n| External Service | ... | ... | -->',
  },
  current_state: {
    id: 'current_state',
    heading: 'Current State',
    description: 'Existing behavior or architecture, if applicable.',
    required: false,
    defaultContent:
      '<!-- TODO: Describe the current system behavior or architecture before this change.\nIf this is a new system, write "N/A — new feature." -->',
  },
  proposed_solution: {
    id: 'proposed_solution',
    heading: 'Proposed Solution',
    description: 'High-level description of the approach chosen.',
    required: true,
    defaultContent:
      '<!-- TODO: Describe the solution in plain language. Why this approach over alternatives? -->',
  },
  key_flows: {
    id: 'key_flows',
    heading: 'User Flow / System Flow',
    description: 'Step-by-step description of the primary user or system flows.',
    required: false,
    defaultContent:
      '<!-- TODO: Describe the main flow step by step.\nStep 1: ...\nStep 2: ...\nStep 3: ...\n\nAdd a Mermaid flowchart or sequence diagram using tdd_generate_mermaid_diagram. -->',
  },
  high_level_architecture: {
    id: 'high_level_architecture',
    heading: 'Architecture',
    description: 'High-level architecture with diagrams showing key components and relationships.',
    required: false,
    defaultContent:
      '<!-- TODO: Add architecture diagram using tdd_generate_mermaid_diagram (type: "component" or "flowchart").\nDescribe key components and their responsibilities below the diagram. -->',
  },
  data_model: {
    id: 'data_model',
    heading: 'Data Model',
    description: 'Main entities, tables, fields, relationships.',
    required: false,
    defaultContent:
      '<!-- TODO: Document new/changed tables, fields, and their types.\nAdd an ER diagram using tdd_generate_mermaid_diagram (type: "entity_relationship") if helpful.\n\n| Table | Field | Type | Notes |\n|---|---|---|---| -->',
  },
  api_interfaces: {
    id: 'api_interfaces',
    heading: 'API / Integrations',
    description: 'External/internal APIs, webhooks, services, tools.',
    required: false,
    defaultContent:
      '<!-- TODO: Document each endpoint or integration.\nMETHOD /path\nRequest: { field: type }\nResponse: { field: type }\nErrors: 4xx/5xx cases\n\nFor external integrations, note auth method and rate limits. -->',
  },
  auth_permissions: {
    id: 'auth_permissions',
    heading: 'Authentication & Permissions',
    description: 'Auth model, roles, access rules.',
    required: false,
    defaultContent:
      '<!-- TODO: Describe the authentication model and permission structure.\n- Auth method: (OAuth, JWT, API key, session, etc.)\n- Roles: ...\n- Access rules: who can read/write/delete what\n- Token lifecycle: expiry, refresh, revocation -->',
  },
  error_handling: {
    id: 'error_handling',
    heading: 'Error Handling',
    description: 'Expected failures and how the system handles them.',
    required: false,
    defaultContent:
      '<!-- TODO: List expected failure modes and the system\'s response.\n| Scenario | Behavior | User Impact |\n|---|---|---|\n| ... | ... | ... | -->',
  },
  security_privacy: {
    id: 'security_privacy',
    heading: 'Security & Privacy',
    description: 'Important security and privacy concerns.',
    required: false,
    defaultContent:
      '<!-- TODO: Answer: What data is handled? Who can access it? What are the attack surfaces? Any GDPR/privacy implications?\n- Data handled: ...\n- Attack surfaces: ...\n- PII: ...\n- Privacy notes: ... -->',
  },
  rollout_plan: {
    id: 'rollout_plan',
    heading: 'Rollout Plan',
    description: 'How this should be released — phases, feature flags, canary, rollback.',
    required: false,
    defaultContent:
      '<!-- TODO: Describe the deployment phases.\nPhase 1: ...\nPhase 2: ...\nRollback plan: ... -->',
  },
  testing_strategy: {
    id: 'testing_strategy',
    heading: 'Testing Plan',
    description: 'How we validate that it works — unit, integration, E2E, manual QA.',
    required: true,
    defaultContent:
      '<!-- TODO: Describe the test plan.\n- Unit tests: ...\n- Integration tests: ...\n- E2E tests: ...\n- Manual QA: ... -->',
  },
  risks: {
    id: 'risks',
    heading: 'Risks / Open Questions',
    description: 'Known risks and unresolved decisions.',
    required: true,
    defaultContent:
      '<!-- TODO: Identify risks and open questions.\n\nRisks:\n| Risk | Likelihood | Impact | Mitigation |\n|---|---|---|---|\n| ... | ... | ... | ... |\n\nOpen Questions:\n- [ ] Question 1 — Owner: @name\n- [ ] Question 2 — Owner: @name -->',
  },
  appendix: {
    id: 'appendix',
    heading: 'Appendix',
    description: 'Extra notes, links, references, screenshots, diagrams.',
    required: false,
    defaultContent:
      '<!-- TODO: Add links, references, ADRs, or supplementary material here. -->',
  },
  // ── Additional sections available for specific modes ──────────────────────
  dependencies: {
    id: 'dependencies',
    heading: 'Dependencies',
    description: 'External services, libraries, teams, or systems this depends on.',
    required: false,
    defaultContent:
      '<!-- TODO: List all external dependencies and their owners.\n| Dependency | Owner | Type | Notes |\n|---|---|---|---| -->',
  },
  observability: {
    id: 'observability',
    heading: 'Observability',
    description: 'Logging, metrics, alerts, dashboards.',
    required: false,
    defaultContent:
      '<!-- TODO: List key metrics to track, log events to emit, and any alert thresholds. -->',
  },
  open_questions: {
    id: 'open_questions',
    heading: 'Open Questions',
    description: 'Unresolved questions that need answers before or during implementation.',
    required: false,
    defaultContent:
      '<!-- TODO: List open questions.\n- [ ] Question 1 — Owner: @name\n- [ ] Question 2 — Owner: @name -->',
  },
};

export const MODE_SECTIONS: Record<DocumentMode, string[]> = {
  // Default full TDD — 18 sections matching the standard structure
  large_feature: [
    'summary',           // Overview
    'problem_context',   // Problem / Context
    'goals',             // Goals
    'non_goals',         // Non-Goals
    'users_actors',      // Users / Actors
    'current_state',     // Current State
    'proposed_solution', // Proposed Solution
    'key_flows',         // User Flow / System Flow
    'high_level_architecture', // Architecture
    'data_model',        // Data Model
    'api_interfaces',    // API / Integrations
    'auth_permissions',  // Authentication & Permissions
    'error_handling',    // Error Handling
    'security_privacy',  // Security & Privacy
    'rollout_plan',      // Rollout Plan
    'testing_strategy',  // Testing Plan
    'risks',             // Risks / Open Questions
    'appendix',          // Appendix
  ],
  // Lightweight TDD for small, well-scoped changes
  small_feature: [
    'summary',
    'problem_context',
    'goals',
    'non_goals',
    'proposed_solution',
    'testing_strategy',
    'risks',
  ],
  // New backend service — includes dependencies and observability
  new_service: [
    'summary',
    'problem_context',
    'goals',
    'non_goals',
    'users_actors',
    'proposed_solution',
    'high_level_architecture',
    'key_flows',
    'api_interfaces',
    'data_model',
    'auth_permissions',
    'dependencies',
    'security_privacy',
    'observability',
    'error_handling',
    'testing_strategy',
    'rollout_plan',
    'risks',
    'appendix',
  ],
  // API / interface change
  api_change: [
    'summary',
    'problem_context',
    'goals',
    'non_goals',
    'current_state',
    'api_interfaces',
    'data_model',
    'auth_permissions',
    'dependencies',
    'security_privacy',
    'testing_strategy',
    'rollout_plan',
    'risks',
  ],
  // Database schema / migration change
  database_change: [
    'summary',
    'problem_context',
    'goals',
    'non_goals',
    'current_state',
    'data_model',
    'dependencies',
    'observability',
    'testing_strategy',
    'rollout_plan',
    'risks',
  ],
  // Infrastructure / DevOps change
  infrastructure_change: [
    'summary',
    'problem_context',
    'goals',
    'non_goals',
    'proposed_solution',
    'high_level_architecture',
    'dependencies',
    'auth_permissions',
    'security_privacy',
    'observability',
    'error_handling',
    'testing_strategy',
    'rollout_plan',
    'risks',
  ],
  // Data migration
  migration: [
    'summary',
    'problem_context',
    'goals',
    'non_goals',
    'current_state',
    'proposed_solution',
    'data_model',
    'dependencies',
    'rollout_plan',
    'risks',
  ],
  // Post-incident review
  incident_followup: [
    'summary',
    'problem_context',
    'current_state',
    'proposed_solution',
    'error_handling',
    'observability',
    'testing_strategy',
    'risks',
  ],
};

export function getSectionsForMode(mode: DocumentMode): SectionDefinition[] {
  const ids = MODE_SECTIONS[mode];
  return ids.map((id) => ALL_SECTIONS[id]).filter(Boolean);
}

export function getSectionById(id: string): SectionDefinition | undefined {
  return ALL_SECTIONS[id];
}

export function getAllSectionIds(): string[] {
  return Object.keys(ALL_SECTIONS);
}
