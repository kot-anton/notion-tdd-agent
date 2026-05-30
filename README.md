# Notion TDD Agent

An MCP server that creates, updates, reviews, and manages **three document types** directly in Notion:

- **System Overview / Product Architecture Overview** — parent-level document describing what is being built, why it exists, the main product capabilities, high-level architecture, core modules, data ownership model, and roadmap.
- **Feature Design** — mid-level document describing how a specific capability or workflow works: user flow, business rules, inputs/outputs, MVP scope, and dependencies. Sits between a System Overview and a TDD.
- **Technical Design Document (TDD)** — child-level document describing how a specific module, feature, service, or logic will be implemented technically.

> **TDD = Technical Design Document** — not test-driven development.

### Document Hierarchy

```
System Overview — My Product                         (parent — what we are building)
├── Feature Design — User Onboarding Flow            (mid-level — what this capability does)
├── Feature Design — Action Approval Workflow        (mid-level — business logic and rules)
├── TDD — Auth / OAuth                               (child — how to implement)
├── TDD — Data Ingestion Pipeline                    (child — how to implement)
├── TDD — AI Processing Pipeline                     (child — how to implement)
├── TDD — Notification Service                       (child — how to implement)
├── TDD — User-Owned Storage                         (child — how to implement)
└── TDD — Data Ownership & Privacy Model             (child — how to implement)
```

---

## Quick Start

```bash
npx notion-tdd-agent init
```

The interactive installer will:
1. Ask for your Notion integration token (hidden input — nothing echoes to screen)
2. Ask for your parent page ID or paste a full Notion URL
3. Save credentials to `.env` automatically
4. Register the MCP server with Claude Code automatically

Then:
```bash
npx notion-tdd-agent doctor   # verify the full setup
```

Restart Claude Code, run `/mcp`, and confirm **notion-tdd-agent** appears in the list.

### Notion credentials

**Integration token:**
1. Go to [app.notion.com/developers/connections](https://app.notion.com/developers/connections)
2. Click **+ New connection** → Authentication method: **Access token**
3. Copy the Internal Integration Secret (starts with `secret_` or `ntn_`)

**Parent page ID:**
1. Open (or create) a Notion page — e.g. "Technical Design Documents"
2. Click `…` → **Connections** → toggle on your integration
3. Copy the 32-char hex ID from the page URL — or paste the full URL, the installer extracts the ID

### Manual MCP registration

If auto-registration during `init` fails, run:

```bash
npx notion-tdd-agent register            # register for current user (recommended)
npx notion-tdd-agent register --scope project  # register for this project only
npx notion-tdd-agent register --scope local    # register locally (not committed)
```

This runs:
```
claude mcp add-json --scope user notion-tdd-agent '{"type":"stdio","command":"npx","args":["notion-tdd-agent","server"],"env":{...}}'
```

### Claude Desktop

For Claude Desktop, add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "notion-tdd-agent": {
      "command": "npx",
      "args": ["notion-tdd-agent", "server"],
      "env": {
        "NOTION_TOKEN": "paste_your_notion_token_here",
        "NOTION_PARENT_PAGE_ID": "paste_your_parent_page_id_here"
      }
    }
  }
}
```

> **Security:** Never commit `.env` or share `NOTION_TOKEN` publicly. Only `.env.example` (which contains empty placeholders) is safe to commit.

---

## CLI Commands

```bash
npx notion-tdd-agent init                          # Interactive setup: collect credentials, save .env, auto-register MCP
npx notion-tdd-agent register                      # Register MCP server with Claude Code (uses existing .env)
npx notion-tdd-agent register --scope project      # Register for this project only
npx notion-tdd-agent register --scope local        # Register locally (not committed)
npx notion-tdd-agent doctor                        # Check Node.js, .env, Notion connection, and MCP registration
npx notion-tdd-agent server                        # Start the MCP server (used by Claude Code / Claude Desktop)
npx notion-tdd-agent config                        # Show current configuration
npx notion-tdd-agent help                          # Show help
```

---

## Document Type Detection

The agent automatically detects which document type to create from your prompt:

| If you say… | Document type created |
|---|---|
| "system overview", "product overview", "platform overview" | System Overview / Product Architecture Overview |
| "product architecture overview", "architecture overview" | System Overview / Product Architecture Overview |
| "what we are building", "project overview", "parent document" | System Overview / Product Architecture Overview |
| "feature design", "capability design", "workflow design" | Feature Design |
| "business logic for X", "how does X work", "user flow for X" | Feature Design |
| "TDD", "technical design document", "technical design" | Technical Design Document |
| "design doc for feature/module", "module design", "service design" | Technical Design Document |

You can also use `document_detect_type` to explicitly check what type the agent would create.

---

## What It Does

- **Creates** professional System Overview, Feature Design, and TDD documents in Notion with a single prompt
- **Updates** specific sections in-place without touching the rest of the page
- **Refactors** existing documents — merges duplicates, fixes diagrams, cleans up v1/v2 confusion
- **Reviews** TDDs for completeness and scores them (0–100, A–F)
- **Audits** documents as a senior technical editor: detects duplicate sections, conflicting architecture, unsafe privacy claims, unclear ownership, and missing MVP/roadmap separation
- **Generates** Mermaid diagrams (flowchart, sequence, ER, component, state, gantt)
- **Produces** image prompts for concept art and architecture illustrations
- **Exports** Notion TDD pages to local Markdown files

### Editorial Quality Checks (automatic)

Before creating or finishing any document, the agent automatically checks for:

| Issue | What it does |
|---|---|
| Duplicate sections | Merges into one canonical section |
| Conflicting architecture | Flags and reconciles prose vs diagrams |
| Absolute privacy claims | Replaces with safe, qualified language |
| Old/new architecture mixed | Labels or separates into Current vs Proposed |
| Unclear ownership model | Adds ownership table if missing |
| Missing Open Questions | Adds the section automatically |
| MVP vs roadmap confusion | Separates or adds status markers |
| Diagrams that don't match prose | Flags and offers corrected version |

---

## Visual Generation

Visual image generation is **enabled by default** for polished System Overview and partner-facing documents.

### How it works

The agent uses a provider-agnostic visual strategy:

- **`IMAGE_PROVIDER=auto` (default)** — uses OpenAI DALL-E 3 if `OPENAI_API_KEY` is set; otherwise falls back to the Claude path (Mermaid/SVG diagrams and image prompts)
- **`IMAGE_PROVIDER=openai`** — explicitly requests OpenAI DALL-E 3 real bitmap images (requires `OPENAI_API_KEY`)
- **`IMAGE_PROVIDER=claude`** — Claude-native path: Mermaid/SVG diagrams, image prompts, and design specs; no bitmap images
- **`IMAGE_PROVIDER=none`** — minimal compact placeholder table only

Mermaid diagrams always work regardless of provider setting.

When bitmap generation is not available, the agent falls back to a compact visual placeholder table and Mermaid diagrams — no document generation steps are skipped.

### Configuration

```env
# Fast draft — no image generation, diagrams + placeholders only
VISUAL_GENERATION_ENABLED=false
DOCUMENT_QUALITY_MODE=draft

# Polished version — use best available provider (OpenAI if key set, else Claude diagrams)
VISUAL_GENERATION_ENABLED=true
IMAGE_PROVIDER=auto
DOCUMENT_QUALITY_MODE=polished

# Explicitly use OpenAI DALL-E 3
IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Supported providers

| Provider | `IMAGE_PROVIDER` value | Requirements |
|---|---|---|
| Auto (recommended) | `auto` | OpenAI key if available; falls back to Claude path |
| OpenAI DALL-E 3 | `openai` | `OPENAI_API_KEY` required |
| Claude (diagrams/prompts) | `claude` | No API key required — Mermaid/SVG/prompts only |
| None (placeholders) | `none` | Minimal compact table only |

### System Overview visuals (up to 6)

When generating a polished System Overview with bitmap generation available, the agent produces up to 6 visuals. The exact visuals depend on your product context — typical examples include:

| Visual | Purpose |
|---|---|
| Product Hero | Investor/partner product overview |
| System Architecture | High-level component diagram |
| Data Ownership Model | Privacy and ownership diagram |
| Core User Journey | Main user flow |
| Key Workflow (e.g. approval flow) | Business logic diagram |
| Data Flow Diagram | End-to-end data movement |

The agent selects the most relevant visuals based on your product description — you do not need to specify them explicitly.

### Notion image insertion

When real images are generated, the agent inserts them as Notion image blocks with captions.
The image URL is a temporary CDN URL — download and host it if you need it long-term.
If the Notion image API call fails, the agent saves the image locally and reports the path.

---

## Usage Examples

Once the MCP server is registered, use natural language in Claude:

### Create a System Overview
```
"Create a system overview for My Product"
"Generate a product architecture overview for my platform"
"Create a high-level overview of what we are building"
```

### Create a Feature Design
```
"Create a feature design for the user onboarding flow"
"Design the action approval capability — what it does and how users interact with it"
"Document the business logic for the notification rules"
```

### Create child TDDs from a System Overview
```
"Create child TDDs from this System Overview: [Notion URL]"
"Create TDD pages for each module under my system overview"
"Generate implementation docs for the modules in this overview"
```

### Create a TDD
```
"Create a new Notion TDD for the auth service"
"Generate a TDD for the data ingestion pipeline"
"Create a small TDD for the notification system"
```

### Update a TDD
```
"Update the data model section of my auth TDD"
"Replace the rollout plan with: Phase 1 — internal beta, Phase 2 — GA"
"Add a risks section to my TDD"
```

### Add diagrams
```
"Add a Mermaid architecture diagram to my TDD"
"Add a sequence diagram for the OAuth login flow"
"Generate an ER diagram for the data model"
```

### Review a TDD
```
"Review my TDD and tell me what's missing"
"Score my auth service TDD"
"Validate the completeness of my TDD"
```

### Refactor / clean up an existing document
```
"Refactor this Notion page — it has duplicate sections and some unsafe privacy claims"
"Clean up the architecture section — v1 and v2 are mixed together"
"Fix the diagram in my TDD so it matches the written architecture"
"Add an Open Questions section to my TDD"
"Soften the privacy claims in this document"
```

---

## TDD Modes

| Mode | Sections | Use when |
|---|---|---|
| `large_feature` | 18 | Default — any significant feature or product work |
| `small_feature` | 7 | Small, well-scoped change |
| `new_service` | 19 | New backend service from scratch |
| `api_change` | 13 | Breaking API change |
| `database_change` | 11 | Schema migrations |
| `infrastructure_change` | 14 | DevOps / deployment changes |
| `migration` | 10 | Data migrations |
| `incident_followup` | 8 | Post-incident review |

---

## Default TDD Structure (`large_feature`)

```
1.  Overview
2.  Problem / Context
3.  Goals
4.  Non-Goals
5.  Users / Actors
6.  Current State
7.  Proposed Solution
8.  User Flow / System Flow
9.  Architecture
10. Data Model
11. API / Integrations
12. Authentication & Permissions
13. Error Handling
14. Security & Privacy
15. Rollout Plan
16. Testing Plan
17. Risks / Open Questions
18. Appendix
```

---

## Feature Design Structure

```
1.  Overview
2.  Problem / User Need
3.  Scope
4.  Users / Actors
5.  User Flow
6.  Business Logic & Rules
7.  Inputs & Outputs
8.  Dependencies
9.  MVP vs Future
10. Open Questions / Risks
```

---

## System Overview Structure

```
1.  Product Vision
2.  Problem / Context
3.  Target Users / Use Cases
4.  What We Are Building
5.  Core Capabilities
6.  High-Level User Flow
7.  Product Architecture
8.  Core Modules
9.  Data Ownership & Privacy Model
10. AI Strategy
11. MVP Scope
12. Future Roadmap
13. Child Technical Design Documents
14. Open Questions / Assumptions
15. Appendix
```

---

## Available MCP Tools

### Auth
- `notion_check_auth` — check credentials (always called first)
- `notion_save_credentials` — save token and page_id to local .env
- `notion_verify_connection` — test live Notion API connection

### System Overview
- `system_overview_create_document` — create System Overview / Product Architecture Overview in Notion
- `system_overview_create_child_tdds` — create child TDD pages from a System Overview's Core Modules table
- `document_detect_type` — detect whether a prompt is asking for a System Overview, Feature Design, or TDD

### TDD
- `tdd_create_document` — create TDD (or Feature Design) and publish to Notion
- `tdd_replace_section_in_page` — find a section by heading and replace its content in place
- `tdd_update_document` — append an update note to a section (non-destructive; use `tdd_replace_section_in_page` for true replacement)
- `tdd_append_section` — append a new section to an existing page
- `tdd_add_mermaid_to_page` — generate diagram and append to page in one step
- `tdd_generate_outline` — preview document structure (no write)
- `tdd_validate_document` — score and grade a TDD (0–100, A–F)
- `tdd_generate_mermaid_diagram` — generate Mermaid syntax, optionally save locally
- `tdd_render_diagram` — render .mmd to SVG/PNG (requires `mmdc`)
- `tdd_generate_image_prompt` — generate image prompt + Notion placeholder
- `tdd_export_markdown` — export Notion page to local .md file

### Notion
- `notion_search_pages` — search workspace pages by title
- `notion_get_page` — get page metadata and blocks
- `notion_create_page` — create raw Notion page
- `notion_update_page` — update page title
- `notion_append_blocks` — append raw block objects to a page

### Design Pages
- `page_design_create` — create styled page from template
- `page_design_preview` — preview template structure
- `page_design_add_section` — add callout / table / toggle / steps / action_items

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NOTION_TOKEN` | Yes | — | Notion Access Token (`secret_` or `ntn_`) |
| `NOTION_PARENT_PAGE_ID` | Yes | — | Parent page ID where documents are created |
| `NOTION_VERSION` | No | `2022-06-28` | Notion API version |
| `GENERATED_FILES_DIR` | No | `generated` | Local directory for .mmd and .md exports |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `VISUAL_GENERATION_ENABLED` | No | `true` | Set to `false` to skip image generation (drafts, CI) |
| `IMAGE_PROVIDER` | No | `auto` | `auto` (default), `openai`, `claude`, `none` — see Visual Generation |
| `OPENAI_API_KEY` | No | — | Required only when `IMAGE_PROVIDER=openai` or `auto` with a key present |
| `DOCUMENT_QUALITY_MODE` | No | `polished` | `polished` generates images; `draft` uses diagrams + placeholders |

Pass these via the `env` block in your MCP config (recommended), or create a local `.env` file for development.

---

## Section Replacement Behavior

`tdd_replace_section_in_page` performs true in-place section replacement:

1. Reads all page blocks (paginated — no 100-block limit)
2. Finds the target heading (case-insensitive, partial match)
3. Records the predecessor block (the block immediately before the section)
4. Collects all blocks until the next same-or-higher-level heading
5. Archives (deletes) the old heading + content blocks
6. Re-inserts the replacement heading + content using `blocks.children.append` with `after: predecessorBlockId`

The section appears at its original position after replacement.

**Edge case:** If the section is the very first block on the page, there is no predecessor to anchor to. The replacement falls back to appending at the end of the page, and the result includes a `warning` field.

---

## Page URL Support

All tools that accept a `page_id` also accept a full Notion URL:

```
# These all work:
notion_get_page page_id=<your-32-char-page-id>
notion_get_page page_id=https://app.notion.com/p/My-Page-<your-32-char-page-id>
notion_get_page page_id=https://www.notion.so/workspace/My-Page-<your-32-char-page-id>
```

The agent also supports searching child pages of a parent when a full title is not found in the workspace search.

## Limitations

- Mermaid diagrams are inserted as code blocks — Notion renders them natively
- `tdd_render_diagram` requires `mmdc`: `npm install -g @mermaid-js/mermaid-cli`
- Real bitmap image generation requires `OPENAI_API_KEY` — without it the agent generates prompts and compact placeholder tables instead
- OpenAI CDN image URLs are temporary — download generated images if you need them long-term
- Notion search is workspace-wide and may surface pages with similar titles
- Child page search requires the integration to have explicit access to each child page

---

## Troubleshooting

| Error | Meaning | Fix |
|---|---|---|
| `NOTION_TOKEN missing` | Token not set | Set in MCP config `env` or create `.env` file |
| `NOTION_PARENT_PAGE_ID missing` | No parent page | Set in MCP config `env` or create `.env` file |
| `401 Authentication failed` | Token invalid or expired | Re-copy token from Notion developers page |
| `403 Access denied` | Integration not added | Page → Connections → toggle on your integration |
| `404 Page not found` | Wrong page ID | Verify the page ID and that integration has access |

Run `npx notion-tdd-agent doctor` for a self-check — it verifies Node.js version, `.env` presence, both credentials, Notion API reachability, and parent page accessibility.

---

## Development

```bash
git clone https://github.com/your-org/notion-tdd-agent.git
cd notion-tdd-agent
npm install
cp .env.example .env     # add your credentials
npm run dev              # start with hot reload (tsx watch, no build needed)
npm run build            # compile TypeScript → dist/
npm run typecheck        # type check without building
npm test                 # run Vitest tests
```

The `.claude/settings.json` in this repo registers the agent via `tsx` for local development — Claude Code will pick it up automatically.

---

## License

MIT — see [LICENSE](LICENSE)

---

*Notion TDD Agent v1.0.0 · MCP server for System Overviews, Feature Designs, and Technical Design Documents in Notion*
