# Notion TDD Agent — Smoke Test Checklist

Manual test checklist to verify the agent works end-to-end after any change.
Run these in order in a fresh Claude Code session.

---

## Prerequisites

```bash
npm run build          # must complete with zero errors
```

Verify MCP registration is active:

```
/mcp
```

You should see `notion-tdd-agent` in the list with status `connected`.

---

## Test 1 — Auth Check (new session)

**Prompt:** `notion_check_auth`

Expected:
- `authenticated: true` if `.env` has both `NOTION_TOKEN` and `NOTION_PARENT_PAGE_ID`
- If missing: step-by-step setup guide, no crash

---

## Test 2 — Create New TDD

**Prompt:** `Create a new Notion TDD for user-owned Supabase authentication`

Expected:
- Agent calls `notion_check_auth` first
- Calls `tdd_create_document` with `mode="large_feature"`
- Returns Notion URL (`https://www.notion.so/...`)
- No "what is a TDD?" confusion
- No request to explain Notion setup

Verify in Notion:
- [ ] Page created under the parent page
- [ ] Contains all 18 sections in correct order (Overview → Appendix)
- [ ] Status callout shows "Draft"
- [ ] Owner and metadata header visible

---

## Test 3 — Add Mermaid Diagram

**Prompt (after Test 2):** `Add a Mermaid architecture diagram to the TDD`

Expected:
- Agent uses the page from Test 2 (or asks which page if context is lost)
- Calls `tdd_add_mermaid_to_page` or `tdd_generate_mermaid_diagram` + `tdd_append_section`
- Returns `mmd_content` and confirms block appended

Verify in Notion:
- [ ] New section appears at end of page
- [ ] Code block with language `mermaid` is visible
- [ ] Notion renders the diagram (not just raw text)

---

## Test 4 — Replace a Section

**Prompt:** `Replace the Data Model section with: "Users table: id, email, created_at. Profiles table: user_id (FK), display_name, avatar_url."`

Expected:
- Agent calls `tdd_replace_section_in_page` with `section_title="Data Model"`
- Returns `found: true`, `deleted_count > 0`, `appended: true`
- No `warning` field (section is not the first block, so positional insertion succeeds)

Verify in Notion:
- [ ] Old "Data Model" section is gone
- [ ] New "Data Model" section appears **at the same position** as the original
- [ ] No other sections affected

---

## Test 5 — Generate Image Prompt

**Prompt:** `Generate a visual concept image for the Supabase auth architecture`

Expected:
- Agent calls `tdd_generate_image_prompt`
- Returns a structured `image_prompt` string
- Returns `notion_placeholder` with image description
- Returns `generation_options` (DALL-E, Midjourney, Stable Diffusion)
- Does NOT try to call any image API (this agent generates prompts only)

---

## Test 6 — Missing Notion Token Error

Set up: temporarily break credentials.

```bash
# In .env, comment out NOTION_TOKEN:
# NOTION_TOKEN=ntn_...
```

Then restart the MCP server and run:

**Prompt:** `Create a new TDD for payment processing`

Expected:
- Agent calls `notion_check_auth`
- Returns `authenticated: false`
- Returns exact setup guide: what is missing, how to get the token, how to save it
- Does NOT attempt any Notion API call
- Does NOT crash

Restore: uncomment `NOTION_TOKEN` in `.env`.

---

## Test 7 — Fresh Claude Code Session (new chat problem)

Close Claude Code completely. Open a new session in this project directory.

**Prompt (no prior context):** `Create a new Notion TDD for the audio transcript processing pipeline`

Expected:
- Agent immediately understands this is a Notion TDD request
- Does NOT ask "what is a TDD?"
- Does NOT ask for Notion credentials if `.env` has them
- Proceeds to `notion_check_auth` → `tdd_create_document`
- Returns Notion URL

This test verifies that `CLAUDE.md` is being read correctly by Claude Code.

---

## Test 8 — Section Not Found (error path)

**Prompt:** `Replace the "Quarterly OKRs" section with new content`

Expected (`mode="replace"` default):
- `found: false`
- `appended: false`
- Clear message: section not found, check heading name or use `mode="append_if_not_found"`

Then try:
**Prompt:** `Replace the "Quarterly OKRs" section using append_if_not_found mode`

Expected:
- `found: false`, `appended: true`
- New "Quarterly OKRs" section appears at end of page

---

## Test 9 — Validate Document

**Prompt:** `Score my Supabase auth TDD and tell me what's missing`

Expected:
- Agent calls `notion_search_pages` to find the page
- Calls `tdd_validate_document`
- Returns score (0–100), grade (A–F), checklist of sections
- Lists missing required sections (if any)

---

## Test 10 — Editorial Refactor (Quality Detection)

**Purpose:** Verify the agent detects and fixes quality issues in an existing document rather than blindly appending.

**Setup:** Use a Notion page that has the following problems (create one or use an existing messy TDD):
- Two sections discussing the same privacy/data isolation concept
- At least one absolute claim like "never stores user data" or "fully private"
- Mixed v1/v2 language without clear separation
- A Mermaid diagram that does not match the written architecture
- A section described as "implemented" when status is actually unclear
- No "Open Questions / Assumptions" section

**Prompt:** `Refactor this Notion page: [URL]. It has duplicate privacy sections, some unsafe privacy claims, v1/v2 confusion, and possible diagram issues. Clean it up.`

Expected behavior:
- Agent calls `notion_check_auth` and `notion_get_page`
- Runs Editorial Quality Check and lists every issue found before touching the page
- Merges the duplicate privacy/data sections into one canonical section
- Replaces absolute claims with safer alternatives (e.g. "designed to" language)
- Separates v1/v2 content — labels old architecture clearly or moves it to Appendix
- Updates or replaces the Mermaid diagram so it matches the prose
- Changes "implemented" status markers to "Planned" or "Target" where appropriate
- Adds an "Open Questions / Assumptions" section if missing
- Runs Final QA Checklist and confirms all items pass
- Returns the Notion URL and a clear itemized summary of every change

Verify in Notion:
- [ ] Only one Data/Privacy section remains (no duplicate)
- [ ] No absolute "never stores" / "fully private" language without qualifier
- [ ] v1/v2 architecture is clearly separated or labelled
- [ ] Mermaid diagram is logically consistent with written architecture
- [ ] Status markers (Planned/Target/Implemented) are correct
- [ ] "Open Questions / Assumptions" section exists
- [ ] Summary returned by agent matches actual changes in Notion

---

---

## Test 11 — Create System Overview (not TDD)

**Prompt:** `Create a system overview for AI Personal Assistant Platform`

Expected:
- Agent calls `notion_check_auth` first
- Detects document type as `system_overview` (NOT a TDD)
- Calls `system_overview_create_document` with appropriate title
- Does NOT call `tdd_create_document`
- Returns Notion URL

Verify in Notion:
- [ ] Page created with title "System Overview — AI Personal Assistant Platform" (or similar)
- [ ] Status callout shows "🏗️ System Overview / Product Architecture Overview — Draft"
- [ ] Metadata table shows "Document Type: System Overview / Product Architecture Overview"
- [ ] Page has 15 sections: Product Vision → Appendix
- [ ] Sections include "Core Modules", "MVP Scope", "Child Technical Design Documents", "Open Questions / Assumptions"
- [ ] Does NOT contain TDD-specific sections: "Testing Plan", "Rollout Plan", "Non-Goals"

---

## Test 12 — Create TDD for specific module

**Prompt:** `Create a TDD for audio transcript ingestion`

Expected:
- Agent detects document type as `tdd`
- Calls `tdd_create_document` with `mode="large_feature"`
- Does NOT call `system_overview_create_document`
- Returns Notion URL

Verify in Notion:
- [ ] Page created with title starting with "TDD —" (e.g., "TDD — Audio Transcript Ingestion")
- [ ] Status callout shows TDD status (Draft, 📝)
- [ ] Page has 18 sections: Overview → Appendix
- [ ] Contains TDD-specific sections: "Proposed Solution", "Testing Plan", "Rollout Plan"

---

## Test 13 — Create child TDDs from System Overview

**Setup:** Use the System Overview created in Test 11 (or the existing one at the URL below).

**Prompt:** `Create child TDDs from this System Overview: [URL from Test 11]`

Expected:
- Agent calls `notion_check_auth`
- Calls `system_overview_create_child_tdds` with `page_id=<overview URL>`
- Reads the "Core Modules" section from the page
- Creates child TDD pages under the System Overview (nested in Notion)
- Updates the "Child Technical Design Documents" section of the overview with a link table
- Returns list of created TDD URLs

Verify in Notion:
- [ ] System Overview page now has child pages (visible as nested sub-pages)
- [ ] Each child is titled "TDD — [Module Name]"
- [ ] Each child TDD has the standard 18-section structure
- [ ] "Child Technical Design Documents" section of overview has a table with links
- [ ] No duplicate child pages created (run again → all skipped)

---

## Test 14 — Refactor existing page as Product Architecture Overview

**Prompt:** `Refactor this page as a product architecture overview, not a full TDD: [URL of existing page]`

Expected:
- Agent calls `notion_check_auth` and `notion_get_page`
- Does NOT add full TDD sections (Testing Plan, Rollout Plan, Non-Goals)
- Restructures the page around: product vision, core modules, architecture, MVP scope, roadmap
- Removes or moves to Appendix any excessive implementation-detail sections
- Runs Final QA Checklist: product-first opening, Core Modules listed, MVP separated from roadmap, Open Questions section present
- Returns Notion URL and summary of changes

Verify in Notion:
- [ ] Page opens with product-first section (not backend architecture first)
- [ ] "Core Modules" table is present
- [ ] "MVP Scope" and "Future Roadmap" are separated
- [ ] "Open Questions / Assumptions" section exists
- [ ] No "Testing Plan", "Non-Goals", "Rollout Plan" sections at the top level (moved to Appendix if needed)
- [ ] No absolute privacy claims ("never stores", "fully private") without qualification

---

## Pass Criteria

| Test | Pass condition |
|---|---|
| 1 | Auth status returned without crash |
| 2 | Notion page created with 18 sections, URL returned |
| 3 | Mermaid diagram appended, Notion renders it |
| 4 | Old section deleted, new content at page end, warning shown |
| 5 | Image prompt returned, no API call attempted |
| 6 | Setup guide shown, no crash, no fake API call |
| 7 | Agent proceeds without setup explanation in fresh session |
| 8 | Not-found error → clear message; append_if_not_found → success |
| 9 | Score and checklist returned |
| 10 | Duplicate sections merged, unsafe claims softened, v1/v2 cleaned, diagram fixed, Open Questions added |
| 11 | System Overview created (15 sections), not TDD; correct heading and metadata |
| 12 | TDD created (18 sections) for specific module; TDD structure not overview structure |
| 13 | Child TDDs created under overview, Child TDDs section updated with links |
| 14 | Page refactored as overview; product-first, MVP/roadmap separated, no excessive TDD sections |
