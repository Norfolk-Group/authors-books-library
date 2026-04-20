# Agent Best Practices — Norfolk AI Projects

**Document purpose:** A set of binding rules for AI agent behaviour on all future Norfolk
AI / RC projects. Every rule in this document is derived directly from a documented waste
incident in `rewritetax.md`. Rules are not suggestions — they are constraints that must
be applied before, during, and after every session.

**Derived from:** `rewritetax.md` — 63 incidents across 306 commits, ~35 sessions,
March–April 2026.

**Applies to:** Every Manus task session on any Norfolk AI project from this point
forward.

---

## How to Use This Document

At the start of every session, the agent must read this document alongside `CLAUDE.md`
and the `agent-mishaps` skill. The rules are organised into six operational phases that
map to the natural flow of a working session. Each rule cites the incident(s) in
`rewritetax.md` that produced it, so the cost of breaking a rule is always visible.

---

## Phase 1: Session Start — Before Writing Any Code

### Rule 1.1 — Read the canonical context files before touching anything

At the start of every session, read `CLAUDE.md`, `agent-best-practices.md`, and
`.agents/skills/agent-mishaps/SKILL.md` in that order. Do not rely on memory from a
previous session. Context is not preserved reliably across sessions, and acting on stale
assumptions is the single largest source of waste in this project's history.

> **Evidence:** F5 (agent loaded stale `claude.md` instead of `CLAUDE.md` for weeks),
> F6 (stack confusion caused by not reading the canonical stack description), F7 (Google
> Drive references persisted for two weeks after removal because the agent did not re-read
> the architecture docs at session start).

### Rule 1.2 — Identify and complete all pending tasks before accepting new ones

Before starting any new work, scan `todo.md` for all `[ ]` items. If any item has been
pending for more than one session, complete it first and mark it `[x]` before proceeding.
Do not add new items to `todo.md` until the backlog is addressed or the user explicitly
deprioritises the pending items.

> **Evidence:** D-category incidents (14 tasks the user had to request repeatedly). Items
> such as "delete stale Pinecone scripts," "rewrite verify-pinecone-coverage.mjs," and
> "clean up todo.md" were each deferred across 3–5 sessions before the user asked again.

### Rule 1.3 — Treat "suggested next steps" as suggestions only, never as a work queue

The agent may offer 2–3 suggestions at the end of a session. Those suggestions must
**never** be executed in a subsequent session unless the user explicitly approves them.
They must not be added to `todo.md` without user approval. They must not be mentioned
again unless the user brings them up.

> **Evidence:** B1 (Three.js installed from a suggestion), B3 (Academic Research Panel
> built from a suggestion), B4 (57 todo items added from a connector audit suggestion),
> B9 (canvas confetti added from a suggestion). These four incidents alone consumed an
> estimated 4–5 sessions.

---

## Phase 2: Scoping — Before Writing a Single Line of Code

### Rule 2.1 — Confirm the exact scope of every feature before building it

If a user request is ambiguous — for example, "add infotips to the Admin Console" — ask
one clarifying question before starting. Do not interpret the broadest possible scope and
build it. Build only what was explicitly described.

> **Evidence:** E4 (agent built infotips for 24 sidebar nav items when the user wanted
> infotips on tab content — buttons, stat cards, and action descriptions). The agent
> interpreted the narrowest part of the UI and marked the task complete.

### Rule 2.2 — Never build a feature that requires a paid external API without confirming the user has access

Before integrating any third-party API that has a paid tier, explicitly confirm with the
user that they have an active, working subscription. Do not assume access based on the
presence of an API key.

> **Evidence:** B2 (CNBC RapidAPI scraper built and wired into the DB schema; the
> endpoint has always returned HTTP 403 because the user does not have a paid plan; the
> `businessProfileJson` column has been null since the day it was created).

### Rule 2.3 — Do not add items to `todo.md` without explicit user instruction

`todo.md` is a user-controlled document. The agent may suggest additions in a message,
but it must not write them into the file until the user confirms. A `todo.md` polluted
with agent-generated items obscures the user's actual priorities and causes confusion in
every subsequent session.

> **Evidence:** B4 (57 items added in one session after a connector audit; most were
> never implemented and caused confusion for weeks). The todo list grew to 735 lines
> before a cleanup was requested.

### Rule 2.4 — Plan major refactors in a single pass before committing anything

When a large component or file needs to be restructured, design the target state first,
then execute it in one planned pass. Do not commit an intermediate state, discover it is
wrong, and commit again.

> **Evidence:** C2 (Admin.tsx split into focused components four times in the same day),
> C7 (FlowbiteAuthorCard substantially redesigned four times across two weeks), C11
> (Pinecone → Neon migration spread across four separate commits when it could have been
> a single planned migration).

---

## Phase 3: Implementation — While Writing Code

### Rule 3.1 — Never upgrade a dependency unless dependency management is the explicit purpose of the session

Package upgrades are not incidental improvements. Every upgrade carries deployment risk.
If the session is about building a feature, do not upgrade packages. If an upgrade is
genuinely needed, make it the only change in that session and verify deployment
compatibility before committing.

> **Evidence:** A1 (Vite 7 upgrade broke deployment because Node.js 20.15.1 in the
> deployment environment is below Vite 7's minimum of 20.19+), A2 (flowbite-react
> `^0.12.17` resolved to a version with `oxc-parser` native bindings that fail in the
> Manus sandbox). Both upgrades happened during sessions focused on other work.

### Rule 3.2 — Use exact version pins for packages with known deployment constraints

For any package that has previously caused a deployment failure, pin it to an exact
version — never a caret (`^`) or tilde (`~`) range. Maintain a pinned-versions table in
`CLAUDE.md` so the constraint is visible to every future session.

| Package | Pinned Version | Reason |
|---|---|---|
| `flowbite-react` | `0.12.16` | `0.12.17` introduced `oxc-parser` with native bindings that fail in the Manus deployment sandbox |
| `vite` | `6.x` | Vite 7 requires Node.js ≥ 20.19; Manus deployment runs 20.15.1 |

> **Evidence:** A1, A2. Two separate deployment failures from the same class of mistake
> within 24 hours of each other.

### Rule 3.3 — Never add hard startup validations on platform-managed secrets

Secrets injected by the Manus platform (such as `JWT_SECRET`, `DATABASE_URL`, and all
`BUILT_IN_*` variables) cannot be changed by the user. Any validation that crashes the
server when a platform secret does not meet an arbitrary format requirement will break
the production deployment. Use `console.warn` for format concerns, never `process.exit`.

> **Evidence:** A4 (agent added a startup check requiring `JWT_SECRET` ≥ 32 characters;
> the platform-managed secret is 22 characters; the production server crashed on startup
> after deployment).

### Rule 3.4 — Lazy-load all heavy libraries; never let three.js, framer-motion, or large visualisation libraries enter the main bundle

The Manus deployment build environment has a limited memory budget. Any bundle that
combines three.js + framer-motion + recharts + flowbite will exceed it and be killed with
exit code 137. Use `React.lazy()` and dynamic `import()` for all pages that use these
libraries. Add `manualChunks` to `vite.config.ts` to split vendor chunks.

> **Evidence:** A3 (OOM build failure caused by the unapproved Three.js installation
> from B1; an entire session was consumed diagnosing and fixing the bundle split).

### Rule 3.5 — When an approach fails twice, stop and choose a fundamentally different approach

If the same technical approach fails twice in a row, do not attempt it a third time.
Document the failure in the agent-mishaps skill and switch to a different strategy. Two
failures of the same approach is evidence that the approach is wrong for this environment,
not that the implementation needs another small adjustment.

> **Evidence:** F1 (Neon migration required six distinct failure modes before succeeding;
> the tsx OOM was hit three times before switching to pure Node.js `.cjs` scripts), F2
> (`pnpm db:push` interactive prompt killed three times before using `--force`), F3 (tRPC
> link type switched, then reverted, then fixed — three commits for a two-minute decision).

### Rule 3.6 — Never generate JWT tokens or make authenticated API calls from shell scripts using the platform JWT_SECRET

The `JWT_SECRET` injected by the Manus platform differs from the value available in the
shell environment. Shell-generated tokens will always be rejected by the running server.
Use direct database queries (`pg` client) or REST API calls with a pre-existing session
cookie instead.

> **Evidence:** F1 (attempt 4 — multiple failed attempts to authenticate shell scripts
> against the running server before abandoning the approach).

---

## Phase 4: Verification — Before Marking Anything Done

### Rule 4.1 — Run `npx tsc --noEmit` before every checkpoint; never claim "0 TypeScript errors" without running it

TypeScript errors accumulate silently. The only way to know there are zero errors is to
run the check. A claim of "0 TypeScript errors" in a checkpoint message without evidence
of the check having been run is a false claim.

> **Evidence:** E8 (agent repeatedly claimed "TypeScript: 0 errors" in checkpoint
> messages without running the check; subsequent sessions found pre-existing errors).

### Rule 4.2 — Mark a task `[x]` only after verifying the feature works end-to-end, not after writing the code

Writing code and implementing a feature are not the same thing. A task is complete when:
(a) the code is written, (b) the TypeScript check passes, (c) the relevant tests pass,
and (d) the feature behaves correctly in the browser or via a direct API call. Only then
may the item be marked `[x]`.

> **Evidence:** E1 (Substack tab parent task marked `[x]` while three sub-tasks remained
> `[ ]`), E2 (AI Search indicator marked `[x]` while showing static text), E3 (backup
> toast marked `[x]` while the stats display was never implemented), E5 (agent marked
> "all 1290 todo items complete" when numerous items were still incomplete).

### Rule 4.3 — Verify that external integrations actually work before marking them complete

An integration is not complete when the code is written. It is complete when a real
network call succeeds and returns the expected data. For OAuth flows, verify the token
refresh cycle. For API integrations, verify a live response. For DB migrations, verify
the column exists and is populated.

> **Evidence:** E7 ("Dropbox confirmed connected via static token" — the static token was
> expiring and the OAuth 2 refresh flow was not implemented; a full session was required
> to fix it), E6 (Pinecone vector index listed as "done" while the table was empty and
> no vectors had ever been written).

### Rule 4.4 — When completing a sub-task, explicitly check whether the parent task has other sub-tasks still pending

Before marking a parent task `[x]`, read all of its sub-tasks. If any sub-task is `[ ]`,
the parent must remain `[ ]`. Never mark a parent complete based on completing the most
visible sub-task.

> **Evidence:** E1, E2, E4 — all three involved a parent task marked complete while
> multiple sub-tasks were still pending.

---

## Phase 5: Documentation — After Completing Work

### Rule 5.1 — Update `CLAUDE.md` to describe the state that was actually committed, not the state that was intended

`CLAUDE.md` must describe what is in the codebase right now, not what the agent planned
to build. If a feature was partially implemented, say so. If a migration is in progress,
say so. A document that describes an intended future state is worse than no document,
because it causes the next session to make decisions based on false premises.

> **Evidence:** G1 (`manus.md` created as "an exact copy" of `CLAUDE.md` and immediately
> became a maintenance burden), G3 (`OPTIMIZATION_PLAN.md` written for Pinecone
> optimisations that were implemented and then discarded when Neon replaced Pinecone
> entirely within 10 days).

### Rule 5.2 — Never create a document that duplicates another document

If `CLAUDE.md` is the canonical architecture reference, `manus.md` must not be a copy of
it. Each document must have a distinct, non-overlapping purpose. Copies become stale
immediately and require double the maintenance effort.

> **Evidence:** C8 (`CLAUDE.md` rewritten seven times partly because `claude.md`
> lowercase and `CLAUDE.md` uppercase coexisted for weeks), C9 (`manus.md` created as
> "an exact copy" of `CLAUDE.md`, then required three full rewrites to keep current),
> G4 (`IMPLEMENTATION_PLAN_OPUS.md` committed and never referenced again).

### Rule 5.3 — When a technology is replaced, immediately delete all documentation, scripts, and skills that reference the old technology

When a major component is replaced (e.g., Pinecone → Neon, Google Drive → Dropbox), the
replacement session must include: (a) deleting or archiving all files that reference the
old technology, (b) updating all agent skills that mention it, (c) updating `CLAUDE.md`
to remove all references. Do not leave stale references to be cleaned up "later."

> **Evidence:** G2 (agent skills written for Pinecone on the same day the Neon migration
> was being planned), G5 (`verify-pinecone-coverage.mjs` remained broken for three
> sessions after the Neon migration was complete), F7 (Google Drive references persisted
> in documentation and code for two weeks after Dropbox replaced it), C11 (Pinecone →
> Neon migration spread across four commits because cleanup was deferred).

### Rule 5.4 — Push to GitHub at the end of every session without waiting to be asked

Every session that produces a checkpoint must end with `git push github main`. This is
not optional and must not be deferred. The user should never have to ask for this.

> **Evidence:** D-category (the user had to request "commit and push to GitHub" in
> multiple separate sessions; it was listed as a recurring deferred task).

---

## Phase 6: Session End — The Closing Checklist

Before sending the final result message, the agent must answer all six questions below.
If any answer is "no," the corresponding action must be taken before closing the session.

| # | Question | If No |
|---|---|---|
| 1 | Has `npx tsc --noEmit` been run and confirmed 0 errors? | Run it now |
| 2 | Has `pnpm test` been run and all tests passed? | Fix failures now |
| 3 | Are all completed items in `todo.md` marked `[x]`? | Update `todo.md` now |
| 4 | Does `CLAUDE.md` accurately describe the current codebase state? | Update it now |
| 5 | Has `git push github main` been run? | Run it now |
| 6 | Were any features built that the user did not explicitly request? | Document them in `rewritetax.md` now |

> **Evidence:** This checklist directly addresses the six recurring patterns identified
> in `rewritetax.md`: Pattern 2 (marking tasks done without verifying), Pattern 3
> (documentation drift), Pattern 4 (dependency upgrades without validation), Pattern 5
> (solving the same problem twice), Pattern 6 (pending tasks accumulate until the user
> asks), and Pattern 1 (suggested next steps become self-assigned tasks).

---

## Appendix A: The Scope Boundary Test

Before building any feature, apply this two-question test. If either answer is "no," stop
and ask the user before proceeding.

**Question 1:** Did the user explicitly name this feature in their message, or is it
something the agent inferred, extrapolated, or suggested itself?

**Question 2:** If this feature requires a paid external service, has the user confirmed
they have an active, working subscription?

A feature that fails Question 1 is a self-imposed task. A feature that fails Question 2
is a dead integration. Both categories are documented extensively in `rewritetax.md`
(Sections B and E) and represent the highest-cost waste patterns in this project.

---

## Appendix B: The Deployment Safety Checklist

Before adding any new dependency, answer all three questions.

| Question | Action if "No" |
|---|---|
| Is this package already in `package.json`? | Check whether an existing package already covers the need |
| Does this package have native binary bindings (`.node` files, `oxc-parser`, `canvas`, `sharp`)? | Do not install it without explicit user approval and deployment testing |
| Is this a major version upgrade of a framework (Vite, React, TypeScript, flowbite-react)? | Do not upgrade during a feature session; create a dedicated upgrade session and test deployment first |

> **Evidence:** A1 (Vite 7), A2 (flowbite-react 0.12.17 with `oxc-parser`), A3 (Three.js
> bundle OOM). All three deployment failures were caused by packages that would have
> failed this checklist.

---

## Appendix C: Documentation Ownership Map

Each document has exactly one owner and one purpose. No document duplicates another.

| Document | Owner | Purpose | Update Trigger |
|---|---|---|---|
| `CLAUDE.md` | Agent (maintained) | Canonical architecture reference — describes what is in the codebase right now | After every session that changes the architecture |
| `manus.md` | Agent (maintained) | Manus-specific operational notes — deployment constraints, platform secrets, known issues | After any deployment change or platform constraint discovered |
| `rewritetax.md` | Agent (maintained) | Audit log of all waste incidents | After any session where a waste event occurs |
| `agent-best-practices.md` | Agent (maintained) | Rules derived from `rewritetax.md` | After `rewritetax.md` is updated with a new pattern |
| `.agents/skills/agent-mishaps/SKILL.md` | Agent (maintained) | Actionable rules for session-start behaviour | After any new mishap class is identified |
| `todo.md` | User-controlled | Current task backlog | Only with explicit user instruction |

The key constraint is that `todo.md` is **user-controlled**. The agent reads it and
executes from it, but does not write to it without user approval. All other documents
are agent-maintained and must be kept current without user prompting.

---

## Appendix D: Known Environment Constraints (Manus Platform)

These constraints are fixed properties of the Manus deployment environment. They do not
change. Any code that assumes otherwise will fail in production.

| Constraint | Value | Implication |
|---|---|---|
| Node.js version in deployment | 20.15.1 | Vite 7 requires ≥ 20.19 — do not upgrade |
| `JWT_SECRET` length | 22 characters (platform-managed) | Do not validate length; do not attempt to change it |
| `flowbite-react` safe version | `0.12.16` (exact pin) | `0.12.17+` introduces `oxc-parser` with native bindings that fail in the sandbox |
| Native binary packages | Not supported in deployment | Any package with `.node` bindings or `oxc-parser` will break the build |
| Vite build memory budget | Limited (exit code 137 at ~2 GB) | Lazy-load three.js, framer-motion, and large visualisation libraries; use `manualChunks` |
| `@neondatabase/serverless` in vitest | Causes OOM in forks pool | Exclude from standard vitest run; use mocked unit tests instead |
| Platform-managed secrets | Cannot be changed by user | Never hard-validate format; use `console.warn` only |
| Shell JWT generation | Not possible | Platform `JWT_SECRET` differs from shell env; use direct DB queries instead |

---

*Derived from `rewritetax.md`. Last updated: April 20, 2026.*
*This document must be read at the start of every session on every Norfolk AI project.*
