# NCG Personal Library — Complete Feature Specification

**Version:** 2.0 · **Date:** April 2026 · **Status:** Authoritative Reference  
**Stack:** React 19 + Tailwind 4 + tRPC 11 + Drizzle ORM + MySQL + AWS S3/CloudFront

---

## Overview

The NCG Personal Library is a content intelligence platform built around a single organizing principle: **authors as first-class entities**. Every feature in the system exists to deepen understanding of the people in the library, not just the books they wrote. The platform has five interconnected layers of capability, each building on the previous.

| Layer | What it does |
|---|---|
| **1. Content Vault** | S3-backed storage for all files; one-way mirror to Dropbox and Google Drive |
| **2. Author Intelligence** | Aggressive multi-source biographical research covering biography, geography, history, family, associations, and intellectual lineage |
| **3. Digital Me** | N+1 LLM synthesis of all author data into a structured RAG persona knowledge file |
| **4. Author Chatbot** | Impersonation chatbot powered by the Digital Me RAG file |
| **5. Interest Contrast** | User-defined interest graph cross-referenced against all author RAG files |

---

## Part 1 — Content Vault & S3 Architecture

### 1.1 Storage Principles

S3 is the **single source of truth** for all files. Google Drive and Dropbox are **organized read-only mirrors** — useful for accessing content from other tools, sharing, and offline access. The sync is strictly one-way: **S3 → external drives**. Files are never read from Dropbox or Drive into S3 via the sync mechanism; ingest is a separate workflow.

### 1.2 S3 Key Structure

```
library/
  {authorSlug}/
    books/
      {bookSlug}/
        {filename}.pdf
        {filename}.mp3
    podcasts/
      {showSlug}/
        {episodeSlug}.mp3
    articles/
      {articleSlug}.pdf
    research/
      {paperSlug}.pdf
    youtube/
      {videoId}-thumbnail.jpg
      {videoId}-metadata.json
```

### 1.3 Target Mirror Structure on Dropbox (and Drive)

```
NCG Knowledge Library/
  Adam Grant/
    Books/
      Hidden Potential/
        hidden-potential.pdf
        hidden-potential.mp3
        _metadata.json
      Think Again/
        think-again.pdf
    Podcasts/
      WorkLife with Adam Grant/
        ep01-the-daily-show.mp3
    Articles/
      nytimes-2024-01-15-hidden-potential.pdf
    Research/
      grant-2013-contaminating-effects.pdf
  Charles Duhigg/
    Books/
      The Power of Habit/
        power-of-habit.pdf
        power-of-habit.mp3
        _metadata.json
```

### 1.4 Sync Rules

| Rule | Detail |
|---|---|
| **Direction** | S3 → Dropbox/Drive only |
| **Trigger** | Manual "Sync Now" button in Admin, or scheduled nightly at 2 AM |
| **Scope** | Only files where `content_items.includedInLibrary = true` are synced |
| **Naming** | Files renamed to clean slugs: `hidden-potential.pdf`, not `Transcript PDF - Hidden Potential (1).pdf` |
| **Deduplication** | If file already exists at target path with same MD5 checksum, it is skipped |
| **Deletions** | Files removed from library are **not** auto-deleted from mirrors; a separate "Clean Up Mirrors" action handles this |
| **Metadata sidecar** | Each book folder gets `_metadata.json`: title, authors, ISBN, rating, summary, S3 URL, tags |
| **Large files** | Audio files > 150 MB use Dropbox upload session API (chunked streaming, no memory buffering) |

### 1.5 Sync Engine Design

The sync runs as a background job on the server:

1. Query all `content_files` joined to `content_items` where `includedInLibrary = true`
2. For each file, compute the target Dropbox path: `NCG Knowledge Library/{authorName}/{contentType}/{contentTitle}/{cleanFileName}`
3. Stream file from S3 directly to Dropbox (no intermediate buffering)
4. Record the Dropbox path in `ingest_sources` table (`type = dropbox_mirror`) for traceability
5. Update sync progress in `sync_jobs` table — visible in Admin Sync Manager

### 1.6 Admin Sync Manager Panel

The Sync Manager panel in Admin provides full visibility and control over the mirror state. It displays the last sync timestamp, total files synced, files skipped (already current), and any errors encountered. The **Sync Now** button triggers an immediate background job. A **Schedule toggle** enables or disables the nightly automatic run. The **Scope selector** allows syncing all included content or limiting the run to specific authors or content types. The **Clean Up Mirrors** button removes files from Dropbox/Drive that are no longer included in the library. A **Connection Status** indicator shows whether Dropbox and Drive OAuth tokens are valid and when they expire.

---

## Part 2 — Author Intelligence: Aggressive Biographical Research

### 2.1 Philosophy

The biographical research pipeline operates on the principle that **context shapes meaning**. An author's ideas cannot be fully understood without knowing where they grew up, who shaped them, what historical forces surrounded their formative years, and who they surround themselves with today. The pipeline therefore goes far beyond a standard biography and assembles a complete contextual portrait of each person.

### 2.2 Research Waterfall (8 Sources)

The pipeline executes sources in order of reliability, merging and deduplicating results at each stage. All raw source responses are stored in `authorBioSourcesJson` for auditability and future re-processing.

| Tier | Source | Data Retrieved |
|---|---|---|
| 1 | **Wikipedia REST API** | Full article text, birth date/place, death date/place, nationality, occupation, education, notable works, awards |
| 2 | **Wikidata** | Structured claims: P19 (birthplace), P20 (death place), P551 (residence), P22/P25 (parents), P26 (spouse), P40 (children), P69 (education), P108 (employer), P856 (website), P2002 (Twitter), P2397 (YouTube), P4265 (Substack) |
| 3 | **Perplexity API** | Deep narrative biography, career timeline, personality traits, known ideologies, causes championed, political/religious leanings (if public), formative experiences, intellectual influences |
| 4 | **Tavily Search API** | Recent interviews, profiles, and articles that reveal current thinking, new projects, and updated personal details |
| 5 | **Google Knowledge Graph** | Entity disambiguation, canonical name variants, related entities, category classification |
| 6 | **Amazon Author Page** | Author's self-written bio, author photo, listed books, author's own description of their work |
| 7 | **LinkedIn (Apify scrape)** | Current role, career history, education, endorsements, recent posts, connections to other known authors |
| 8 | **LLM Synthesis** | Final pass using Gemini/Claude to reconcile conflicts, fill gaps, and produce structured output from all collected data |

### 2.3 Biographical Data Model

The following dimensions are extracted and stored in structured JSON columns on `author_profiles`:

**Identity & Biography**

| Dimension | Fields |
|---|---|
| Core identity | Full legal name, preferred name, known pseudonyms, birth date, birth place (city, country), death date (if applicable), nationality, ethnicity (if publicly stated), languages spoken |
| Physical presence | Height, distinctive physical traits, typical presentation style, dress sense — sourced from interviews and photos; used by AI avatar generation |
| Personality | MBTI type (if self-disclosed or widely reported), known temperament descriptors, communication style, humor style, energy level |

**Geographical Context**

The geography layer captures not just where an author was born but the full arc of their spatial biography, because place shapes perspective in profound ways. The pipeline extracts birthplace, childhood city, cities lived in during formative years (ages 10–25), current base of operations, countries visited or lived in for extended periods, and the cultural regions that most influenced their thinking. This data is sourced from Wikidata P19/P551, Wikipedia, and Perplexity narrative research. The LLM synthesis stage uses this geography to annotate the author's worldview — for example, noting that an author who grew up in apartheid South Africa will carry different assumptions about systemic inequality than one raised in suburban Minnesota.

**Historical & Era Context**

Every author is a product of their time. The pipeline computes the decade in which the author was born and identifies the major world events that occurred during their formative years (roughly ages 10–25). These events — wars, social movements, economic crises, technological shifts, cultural revolutions — are documented as `formativeEraEventsJson` and used by the RAG synthesis to explain why the author holds certain views, uses certain metaphors, or returns to certain themes repeatedly.

**Family & Upbringing**

| Dimension | Fields |
|---|---|
| Parents | Names, professions, socioeconomic class, nationality, immigration background |
| Siblings | Number, birth order, notable sibling relationships |
| Spouse/Partner | Name, profession, relationship duration, influence on author's work |
| Children | Number, ages (approximate), any publicly known details |
| Family culture | Religious background, political leanings of family of origin, family values as described by the author |

**Associations & Networks**

| Dimension | Fields |
|---|---|
| Mentors | Names, how they met, what the mentor contributed to the author's development |
| Proteges | Names of people the author has publicly mentored |
| Collaborators | Frequent co-authors, co-presenters, business partners |
| Intellectual rivals | Public disagreements, competing schools of thought |
| Organizations | YPO, WEF, TED, Aspen Ideas, think tanks, boards, advisory roles |
| Universities | Attended, faculty positions, honorary degrees |
| Fraternities/societies | Secret societies, honor societies, professional associations |

**Intellectual Lineage**

| Dimension | Fields |
|---|---|
| Cited influences | Authors, thinkers, and books most frequently cited by this author |
| School of thought | Behavioral economics, stoicism, positive psychology, systems thinking, etc. |
| Academic advisors | PhD/postdoc supervisors and their influence |
| Intellectual descendants | Who cites this author most; who they have influenced |
| Signature frameworks | Named models or frameworks the author created (e.g., "Atomic Habits", "Flow State", "Grit Scale") |

**Formative Experiences**

Known pivotal moments — traumas, epiphanies, career near-misses, transformative travel, personal losses — that the author has publicly described in books, interviews, or talks. These are sourced from Perplexity narrative research and, where available, from the author's own books stored in S3 (analyzed via LLM content extraction).

### 2.4 Bio Completeness Score

A `bioCompleteness` score from 0–100 is computed based on the number of populated fields across all dimensions, weighted by importance. The score drives the color-coded badge on author cards: red below 40, amber 40–70, green above 70. The Admin Console shows a distribution chart of completeness scores across all authors and a sorted list of the least-complete profiles to prioritize research runs.

---

## Part 3 — Digital Me: The RAG Persona Knowledge File

### 3.1 Concept

The Digital Me is a structured Markdown document stored in S3 that encapsulates everything the system knows about an author — their biography, their ideas, their voice, their personality, their worldview — in a form that can be injected as a system prompt into an LLM to produce a convincing, knowledge-grounded impersonation of that author.

The key design principle is **N+1 LLM calls**: one LLM call per content item (book chapter summaries, podcast episode transcripts, article extracts) to produce per-item insight extracts, followed by one final synthesis call that reads all the extracts plus the full biographical profile and produces the unified RAG file. This approach avoids context window overflow while ensuring the final persona is grounded in the full breadth of the author's output.

### 3.2 RAG File Structure

```markdown
# Digital Me: {Author Name}
## Version {n} · Generated {date} · {word count} words

---

## 1. Identity & Biographical Foundation
[Full biography with geographical, historical, and family context woven in]

## 2. Formative Context
[Era, geography, family background, and how these shaped the author's worldview]

## 3. Core Ideology & Worldview
[Fundamental beliefs, philosophical positions, political/social stances if public]

## 4. Favorite Subjects & Recurring Themes
[Topics the author returns to repeatedly across all content types]

## 5. Voice, Tone & Writing Style
[How the author writes and speaks: sentence length, vocabulary level, use of humor,
 use of data, storytelling patterns, rhetorical devices]

## 6. Signature Frameworks & Mental Models
[Named models, coined terms, proprietary frameworks]

## 7. Personality & Behavioral Traits
[Introvert/extrovert, directness, warmth, intellectual style, known quirks]

## 8. Physical Presence & Personal Brand
[How the author presents publicly: dress, energy, speaking style, stage presence]

## 9. Causes, Advocacy & Values
[Publicly championed causes, charitable work, political/social positions]

## 10. Intellectual Influences & Associations
[Mentors, cited influences, intellectual rivals, organizational affiliations]

## 11. Signature Phrases & Rhetorical Patterns
[Actual quotes, catchphrases, typical sentence openers, favorite analogies]

## 12. Content Catalog Summary
[One-paragraph summary of each book, article, podcast, and video in the library,
 with key insight extracted per item]

## 13. Known Gaps & Contradictions
[Areas where the author has changed their mind, been inconsistent, or where the
 system has low confidence — important for the chatbot to handle gracefully]
```

### 3.3 N+1 Pipeline Execution

The pipeline runs as follows:

1. **Gather inputs**: Retrieve all content items for the author where `includedInLibrary = true`. Retrieve the full biographical profile from `author_profiles`.
2. **Per-item extraction (N calls)**: For each content item that has a file in S3, run an LLM call to extract: key ideas, notable quotes, recurring themes, and the author's emotional register in that work. For items without files (YouTube videos, podcasts), use the description and any available transcript.
3. **Synthesis call (1 call)**: Feed all per-item extracts plus the full biographical profile into a single large-context LLM call (Gemini 2.5 Pro or Claude Opus) with a structured prompt that produces the RAG file in the format above.
4. **Store**: Upload the RAG file as `library/{authorSlug}/digital-me/rag-v{n}.md` to S3. Record the S3 URL, key, version number, word count, model used, and generation timestamp in `author_rag_profiles`.
5. **Trigger re-generation**: The RAG file is automatically marked stale when new content is added to the author, when the biographical profile is updated, or when the user manually requests regeneration.

### 3.4 RAG Profile Table

```sql
author_rag_profiles:
  id, authorName (FK), ragFileUrl, ragFileKey, ragVersion,
  ragGeneratedAt, ragWordCount, ragModel, ragVendor,
  ragStatus ENUM('pending','generating','ready','stale'),
  contentItemCount, bioCompletenessAtGeneration,
  createdAt, updatedAt
```

### 3.5 Admin Controls

The Admin Console includes a **Digital Me** tab showing the RAG generation status for every author. Each row displays the author name, RAG status badge, version number, generation date, word count, and content item count used. Buttons allow generating or regenerating individual RAG files, or running a batch "Generate All" job with a progress bar. The model selector (Gemini radio buttons) is available at the top of the tab.

---

## Part 4 — Author Impersonation Chatbot

### 4.1 Architecture

The chatbot is powered by a standard LLM chat completion API with the author's RAG file injected as the system prompt. The system prompt instructs the model to respond as the author would, drawing on the knowledge, voice, and personality encoded in the RAG file. The chatbot does not have access to real-time information; it speaks from the perspective of the author's published body of work.

### 4.2 System Prompt Template

```
You are {Author Name}. You are not an AI assistant — you are {Author Name} themselves,
responding as they would based on their published works, known views, and personal style.

Use the following knowledge file to ground your responses:

{RAG FILE CONTENT}

Rules:
- Speak in first person as {Author Name}
- Draw on specific books, articles, and ideas from your catalog when relevant
- Match the author's known voice, tone, and rhetorical style
- If asked about something outside your known body of work, respond as the author
  would: with intellectual curiosity, appropriate humility, and grounded in your
  known frameworks
- Do not claim to know things the author could not know (events after their last
  known publication, private information not in their public record)
- End responses with a characteristic phrase or question that the author would use

Disclaimer to include once per conversation: "I am an AI simulation of {Author Name}
based on their published works. I am not the real person."
```

### 4.3 UI Design

The chatbot opens as a full-page route (`/chat/{authorSlug}`) with the author's avatar displayed prominently in the header alongside a "Speaking as {Author Name}" badge. The chat interface uses the existing `AIChatBox.tsx` component as a base, extended with author-specific styling. A disclaimer banner appears at the top of every new conversation. A **Reset Conversation** button clears the history. The **Chat with {Author}** entry point appears as a button on every author card and on the author detail page.

---

## Part 5 — User Interest Graph & RAG Contrast Engine

### 5.1 Concept

The user maintains a personal list of interests, subjects, and topics they are currently focused on. The system cross-references this interest graph against every author's RAG file to produce alignment scores, enabling the user to answer questions such as: "Which authors in my library are most relevant to my current thinking on behavioral change?" or "How do Adam Grant and Carol Dweck each approach the topic of Growth Mindset?"

### 5.2 Interest Data Model

```sql
user_interests:
  id, userId, topic (text), description (optional text),
  weight ENUM('low','medium','high','critical'),
  category (text, e.g. "Leadership", "Neuroscience"),
  color (hex, for UI display),
  createdAt, updatedAt

author_interest_scores:
  id, authorName (FK), interestId (FK),
  score INT (0–10), rationale (text, one sentence),
  computedAt, modelUsed
```

### 5.3 Admin → My Interests Panel

The My Interests panel in Admin provides full CRUD management of the user's interest list. Each interest is displayed as a card showing the topic name, optional description, priority weight, and category. Interests can be created via a simple form (topic name required, description and weight optional), edited inline, and deleted with a confirmation dialog. Interests can be grouped into named clusters (e.g., "Leadership", "Neuroscience", "Business Strategy") and reordered by drag-and-drop within each cluster. The panel also shows, for each interest, how many authors in the library have been scored against it and the average score.

### 5.4 RAG Contrast Engine

When the user adds or edits an interest, the system automatically queues a scoring job for all authors with a ready RAG file. The scoring LLM call receives the author's RAG file and the full list of user interests, and returns a score from 0–10 plus a one-sentence rationale for each interest. Scores are stored in `author_interest_scores` and re-computed whenever the RAG file is regenerated or the interest definition changes.

### 5.5 Interest Alignment Views

**On Author Cards:** The top 2–3 matching interests are displayed as colored pills below the author's name, each showing the interest name and a small score indicator. Only interests scoring 6 or above are shown.

**Author Discovery by Interest:** The sidebar filter panel includes an Interest Alignment section where the user can select one or more interests and filter the author list to show only authors scoring above a configurable threshold on those interests.

**Interest Heatmap in Admin:** A matrix view with authors as rows and interests as columns. Each cell is color-coded from red (score 0–3) through amber (4–6) to green (7–10). The matrix is sortable by any column and exportable as CSV.

**Group Contrast:** The user can select 2–5 authors and choose an interest, then trigger a comparative LLM analysis that produces a structured comparison of how each author approaches that topic — drawing on their RAG files. The output is displayed as a formatted report and can be exported.

**Interest-to-Content Mapping:** For each interest, the system surfaces the top 5 most relevant books, articles, and podcasts across all authors, ranked by semantic relevance to the interest description. This is computed via LLM semantic scoring over the content catalog summaries in each RAG file.

**"Why This Author?" Explainer:** A button on each author card generates a 3-sentence explanation of why this author is relevant to the user's current interest profile, written in plain language and grounded in specific works.

---

## Part 6 — Schema Changes Required

The following new tables must be added to `drizzle/schema.ts` and migrated via `pnpm db:push`:

| Table | Purpose |
|---|---|
| `author_rag_profiles` | Tracks RAG file versions, S3 location, generation metadata |
| `content_items` | Universal content model for all content types beyond books |
| `author_content_links` | M:M join table: authors ↔ content items with role (primary, co-author, editor) |
| `content_files` | S3 file tracking per content item (one item can have multiple files: PDF + MP3) |
| `ingest_sources` | Tracks where each piece of content originated (Drive, Dropbox, manual, scrape) |
| `author_subscriptions` | Periodic refresh subscriptions (YouTube channel, Substack, podcast feed) |
| `sync_jobs` | Tracks Dropbox/Drive sync runs with per-file status |
| `user_interests` | User-defined interest topics with weight and category |
| `author_interest_scores` | Per-author per-interest alignment scores with rationale |

Existing tables `author_profiles` and `book_profiles` are preserved. The `author_profiles` table receives new columns: `authorContextJson` (geography, history, family, associations), `authorBioSourcesJson` (raw source responses), `bioCompleteness` (0–100 score), `formativeEraEventsJson`, and `intellectualLineageJson`.

---

## Part 7 — Implementation Order

The phases below are ordered to minimize risk and deliver user-visible value at each step.

| Phase | Deliverable | Depends On |
|---|---|---|
| **Phase 1** | Schema migration — all new tables added and migrated | Nothing |
| **Phase 2** | Aggressive biographical research pipeline (8-source waterfall + contextual layers) | Phase 1 |
| **Phase 3** | Digital Me RAG pipeline (N+1 LLM synthesis, S3 storage, Admin controls) | Phase 2 |
| **Phase 4** | Author Impersonation Chatbot UI | Phase 3 |
| **Phase 5** | User Interest Graph (Admin CRUD panel) | Phase 1 |
| **Phase 6** | RAG Contrast Engine (scoring, heatmap, group contrast) | Phase 3, Phase 5 |
| **Phase 7** | S3-to-Dropbox/Drive sync engine | Phase 1 |
| **Phase 8** | UI updates: author detail tabs, Digital Me status, Chat button, interest pills | Phase 3, Phase 6 |

---

*Document maintained by the NCG Library engineering team. Last updated: April 2026.*
