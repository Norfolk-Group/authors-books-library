# Agent Mishaps — RC Authors & Books Library

**Read this skill at the start of every session before making any changes.**

This skill documents every instance where the AI agent made mistakes, added unapproved
tasks, forgot to implement things, or failed to execute user instructions. It exists to
prevent the same mistakes from being repeated.

---

## Rule 0: Do Not Trust Previous "Done" Claims

Before marking any task complete, verify it yourself. The agent has a history of:
- Marking parent tasks `[x]` while leaving sub-tasks `[ ]`
- Claiming features are "wired" when they only have placeholder toasts
- Saying "TypeScript: 0 errors" without running `npx tsc --noEmit`

---

## Self-Imposed Tasks Added Without User Approval

The following were **added to `todo.md` by the agent without user request**:

### Built Without Approval (Still in Codebase)
- **`client/src/components/FloatingBooks.tsx`** — Three.js 3D floating book shapes. Agent
  installed `@react-three/fiber` + `@react-three/drei` and wired it into `Home.tsx`. User
  never asked for this. The packages add ~800KB to the bundle.
- **`AcademicResearchPanel.tsx` + `academicResearchJson` DB column** — Full academic
  research panel using OpenAlex/Semantic Scholar. Added `academicResearchJson` column to
  `author_profiles` table. User never explicitly requested this.
- **CNBC RapidAPI scraper** — Built a full CNBC franchise feed scraper in
  `server/enrichment/rapidapi.ts` without confirming the user had a paid RapidAPI
  subscription. The endpoint requires a paid plan and has **never worked** (always 403).
  The `businessProfileJson` column is always null. CNBC badges always show 0.

### Recommended and Added to Todo Without Approval (Never Built)
In one session (Mar 25, 2026), after a connector audit, the agent added **57 new todo
items** without user approval. Most were never implemented:
- Quartr earnings call transcripts
- Apollo.io professional profiles
- Notion bidirectional reading notes sync
- Context7 technical book references
- Curated Reading Paths (guided learning sequences)

### Built Then Cancelled (Removed from Codebase)
- **Seeking Alpha** — Built enrichment, user cancelled, removed.
- **SimilarWeb** — Agent recommended and started integration, user cancelled, rolled back.

---

## Forgotten Tasks — Marked Done But Weren't

| Item | What Was Claimed | Reality |
|---|---|---|
| **Substack tab** | `[x]` "Add Substack tab to AuthorDetail" | `SubstackPostsPanel` is wired, but 3 sub-tasks remain `[ ]`: procedure use, post display, empty state |
| **AI Search Status Indicator** | `[x]` "Add AI Search indicator to sidebar" | Shows static text. 3 sub-tasks remain `[ ]`: green/grey dot, link to Admin, nudge when empty |
| **Backup toast with file counts** | `[x]` in one session | Backup mutations return stats, but the UI toast was never implemented. Re-opened as `[ ]` |
| **Admin infotips on tab content** | `[x]` for nav items | Only 24 nav item infotips done. Tab content infotips (buttons, stat cards) never done |
| **Populate vector index** | Listed as done in migration notes | Magazine feeds table is empty; the Pinecone-era todo item was never updated for Neon |

---

## Coding Failures That Required Multiple Retries

### Neon Migration (Apr 18, 2026) — 6 Failed Attempts Before Success

1. **Wrong embedding model** — Used `text-embedding-004` → 404 error. Correct model:
   `gemini-embedding-001` with `outputDimensionality: 1536`.

2. **tsx OOM** — Three tsx-based indexing scripts all crashed before processing a single
   record. The tsx + Neon driver + Drizzle stack consumes ~2GB just to start. Solution:
   pure Node.js `.cjs` scripts using `pg` + Gemini REST API directly.

3. **`@neondatabase/serverless` OOM in vitest** — The driver is too large for vitest
   workers. Required 4 attempts before settling on mocked unit tests.

4. **JWT auth from shell** — Cannot generate valid admin JWT tokens from shell because the
   server's `JWT_SECRET` is injected by the Manus platform and differs from the shell env.
   Do not attempt this. Use direct DB + REST API scripts instead.

5. **Stale `-chunk0` IDs** — First tsx run created `author-{id}-chunk0` IDs. Second pg run
   created `author-{id}` IDs. Both coexisted. Required manual cleanup of 159 duplicates.

6. **`ON CONFLICT` clause wrong** — Used `ON CONFLICT (id, namespace)` but the table has
   no composite unique constraint. Fix: `ON CONFLICT (id)`.

### Drizzle `pnpm db:push` Interactive Prompt
`pnpm db:push` hangs waiting for interactive input when renaming columns (rename vs.
create new). Agent killed the process 3 times. Use `--force` flag or answer the prompt
interactively.

### Vite 7 Upgrade (Rolled Back)
Agent upgraded Vite 6 → 7. Deployment failed: Node.js 20.15.1 in deployment env is below
Vite 7's minimum of 20.19+. **Do not upgrade Vite past 6.x.**

### flowbite-react `0.12.17` Upgrade (Rolled Back)
Agent upgraded to `0.12.17`. Deployment failed: `oxc-parser` has native bindings that
fail in deployment. **Pin flowbite-react to `0.12.16`.**

### CLAUDE.md Loaded Wrong File (Multiple Sessions)
Agent loaded `claude.md` (lowercase, stale) instead of `CLAUDE.md` (uppercase, canonical).
Both files coexisted for weeks. **`claude.md` has been deleted. `CLAUDE.md` is canonical.**

### Stack Confusion (Early Sessions)
Agent confused MySQL/TiDB/Drizzle stack with Postgres/Prisma (Manus template default).
Caused failed `db:push` commands and wrong schema syntax. **This project uses MySQL/TiDB
with Drizzle ORM. Never use Prisma syntax.**

### Google Drive Removal (Mar 2026)
Agent built extensive `gws`/`rclone` Google Drive integration. User switched to Dropbox.
Agent continued referencing Google Drive in docs for 2+ weeks after removal. **Google
Drive is permanently removed. Never add `gws` or `rclone` calls.**

---

## Tasks Explicitly Requested But Never Executed

These were **user-requested** and remain incomplete:

| Task | Status |
|---|---|
| Delete 6 stale Pinecone files | Still exist: `pinecone.service.ts`, `pinecone.test.ts`, `indexAllToPinecone.mjs`, `indexAllToPinecone.py`, `index_pinecone_batched.ts`, `verify-pinecone-coverage.mjs` |
| Rewrite `verify-pinecone-coverage.mjs` → `verify-neon-coverage.mjs` | Script still crashes (uses Pinecone SDK) |
| Implement "Refresh All Data" in `AuthorCardActions.tsx` | Shows "coming soon" toast. Never wired. |
| Complete Re-index All button with live progress in Admin | `vectorSearch.indexEverything` is a stub. Work interrupted. |
| Set `VITE_APP_LOGO` in Management UI | Manual step never done |
| Run Substack post count enrichment | 40 authors have `substackUrl` but post counts are 0 |
| Build Dropbox inbox ingestion pipeline | `dropboxIngest.service.ts` exists but not wired |
| S3 migration audit (external URLs → s3AvatarUrl) | Migration service planned, never built |
| Delete `client/src/lib/authorAliases.ts` | Still exists; superseded by DB |
| Delete `client/src/lib/authorAvatars.ts` | Still exists; superseded by DB |
| Commit and push to GitHub | Git history diverged; push was interrupted by repo rename |

---

## How to Use This Skill

At the start of a session, read this file and:
1. Check if the user's request relates to any item in "Tasks Explicitly Requested But Never Executed" — if so, complete it first.
2. Do not add new items to `todo.md` without explicit user approval.
3. Do not mark tasks `[x]` until you have verified the implementation works end-to-end.
4. When a coding approach fails twice, stop and try a fundamentally different approach.
5. After any migration or major change, run `npx tsc --noEmit` and verify the test count.
