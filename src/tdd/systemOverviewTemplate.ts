export interface SystemOverviewSectionDefinition {
  id: string;
  heading: string;
  description: string;
  required: boolean;
  defaultContent: string;
}

export const SYSTEM_OVERVIEW_SECTIONS: SystemOverviewSectionDefinition[] = [
  {
    id: 'product_vision',
    heading: 'Product Vision',
    description: 'What we are building and why.',
    required: true,
    defaultContent:
      '<!-- TODO: Describe the product in 2–3 sentences. What exists, why it matters, and what outcome it enables for users. -->',
  },
  {
    id: 'problem_context',
    heading: 'Problem / Context',
    description: 'What problem this product solves.',
    required: true,
    defaultContent:
      '<!-- TODO: Describe the current pain point or gap. Include data or user feedback if available. -->',
  },
  {
    id: 'target_users',
    heading: 'Target Users / Use Cases',
    description: 'Who uses it and in what situations.',
    required: true,
    defaultContent:
      '<!-- TODO: Describe primary and secondary users. List 2–4 core use cases.\n\n| User | Use Case | Frequency |\n|---|---|---|\n| ... | ... | ... | -->',
  },
  {
    id: 'what_we_are_building',
    heading: 'What We Are Building',
    description: 'Plain-English product explanation — no backend jargon.',
    required: true,
    defaultContent:
      '<!-- TODO: Explain the product in plain English — product value first.\n' +
      '     Describe it as you would to a potential partner or non-technical user.\n' +
      '     NOTE: Do not include environment variables, npm commands, MCP config,\n' +
      '     developer setup steps, or internal account details here.\n' +
      '     Those belong in the internal README / setup document. -->',
  },
  {
    id: 'core_capabilities',
    heading: 'Core Capabilities',
    description: 'Main product features and modules with MVP/Future status.',
    required: true,
    defaultContent:
      '<!-- TODO: List the main product capabilities.\n\n| Capability | Purpose | MVP / Future | Related TDD |\n|---|---|---|---|\n| ... | ... | MVP | — |\n| ... | ... | Future | — | -->',
  },
  {
    id: 'user_flow',
    heading: 'High-Level User Flow',
    description: 'Simple user journey from entry point to value.',
    required: false,
    defaultContent:
      '<!-- TODO: Describe the main user journey in 5–8 steps.\n\nStep 1: User opens the app / starts here\nStep 2: ...\nStep 3: ...\n\nAdd a Mermaid flowchart using tdd_add_mermaid_to_page (type: "flowchart"). -->',
  },
  {
    id: 'product_architecture',
    heading: 'Product Architecture',
    description: 'High-level architecture diagram and component explanation.',
    required: true,
    defaultContent:
      '<!-- TODO: Describe the major system components and their relationships at a high level.\n\n' +
      'Add a high-level architecture diagram using tdd_add_mermaid_to_page (type: "component").\n' +
      'Keep to ~10 nodes — deeper detail belongs in child TDDs.\n\n' +
      'NOTE: Do not include full API endpoint specs, database schemas with all fields,\n' +
      'HTTP error code tables, or rollout/testing plans here.\n' +
      'Those belong in child TDDs. Keep this section at component boundary level. -->',
  },
  {
    id: 'core_modules',
    heading: 'Core Modules',
    description: 'Major system modules with responsibility, status, and linked child TDDs.',
    required: true,
    defaultContent:
      '<!-- TODO: List the main system modules.\n\n| Module | Responsibility | Status | Child TDD |\n|---|---|---|---|\n| Input Capture | ... | Planned | — |\n| AI Processing Layer | ... | Planned | — |\n| User-Owned Storage | ... | Planned | — |\n| Auth / OAuth | ... | Planned | — |\n| Notifications | ... | Planned | — |\n| Mobile / Web App | ... | Planned | — | -->',
  },
  {
    id: 'data_ownership_privacy',
    heading: 'Data Ownership & Privacy Model',
    description: 'High-level data ownership and privacy design intent.',
    required: true,
    defaultContent:
      '<!-- TODO: Describe the data ownership model at a high level.\n' +
      '- Who owns what data?\n' +
      '- Where is user data stored?\n' +
      '- What data does company infrastructure hold?\n' +
      '- Privacy design intent (use "designed to" / "target model" language — avoid absolute claims\n' +
      '  such as "company has no access", "data never leaves", or "fully private".\n' +
      '  These require legal review and should not appear in a product overview.) -->',
  },
  {
    id: 'ai_strategy',
    heading: 'AI Strategy',
    description: 'High-level AI provider and agent strategy.',
    required: false,
    defaultContent:
      '<!-- TODO: Describe the AI strategy.\n- What AI providers are used / considered?\n- What is the agent or pipeline design?\n- What are the key AI-driven capabilities?\n- What data flows through AI systems? -->',
  },
  {
    id: 'mvp_scope',
    heading: 'MVP Scope',
    description: 'Capabilities and modules in scope for MVP.',
    required: true,
    defaultContent:
      '<!-- TODO: List what is in scope for MVP.\n- Feature/module 1\n- Feature/module 2\n\nKeep this focused. Everything else goes in Future Roadmap. -->',
  },
  {
    id: 'future_roadmap',
    heading: 'Future Roadmap',
    description: 'Post-MVP capabilities and improvements.',
    required: false,
    defaultContent:
      '<!-- TODO: List future capabilities and improvements.\n- Phase 2: ...\n- Phase 3: ...\n\nThese are directional targets, not commitments. Mark each as Planned/Proposed. -->',
  },
  {
    id: 'child_tdds',
    heading: 'Child Technical Design Documents',
    description: 'Index of TDD pages for each major module.',
    required: false,
    defaultContent:
      '<!-- TODO: List child TDD documents for each module.\n\n| TDD Document | Module / Feature | Status | Notes |\n|---|---|---|---|\n| TDD — [Module Name] | ... | Not Started | — |\n| TDD — [Module Name] | ... | Not Started | — | -->',
  },
  {
    id: 'open_questions',
    heading: 'Open Questions / Assumptions',
    description: 'Unresolved questions and key assumptions.',
    required: true,
    defaultContent:
      '<!-- TODO: List open questions and assumptions.\n\nOpen Questions:\n- [ ] What is implemented vs planned?\n- [ ] Who owns which accounts?\n- [ ] What is the MVP launch criteria?\n\nAssumptions:\n- Assumption 1\n- Assumption 2 -->',
  },
  {
    id: 'appendix',
    heading: 'Appendix',
    description: 'Architecture history, older diagrams, references.',
    required: false,
    defaultContent:
      '<!-- TODO: Add links, references, architecture history, or supplementary material here. -->',
  },
];

export function getSystemOverviewSections(): SystemOverviewSectionDefinition[] {
  return SYSTEM_OVERVIEW_SECTIONS;
}

export function getSystemOverviewSectionById(
  id: string
): SystemOverviewSectionDefinition | undefined {
  return SYSTEM_OVERVIEW_SECTIONS.find((s) => s.id === id);
}
