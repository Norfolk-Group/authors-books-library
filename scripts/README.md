# Scripts

One-off and maintenance scripts for the Authors & Books Library.

> **Rule:** Scripts are for local/sandbox use only. They run against the live database via `DATABASE_URL`. Never commit secrets.

---

## Maintenance Scripts (safe to re-run)

### `batch-regenerate-avatars.mjs`

Upgrades all author avatars to the Tier 5 meticulous pipeline (Tavily research → Gemini Vision → 10-section prompt → Gemini Imagen).

**When to run:** When a batch of authors needs their avatars upgraded from Drive-sourced or older AI-generated portraits to the current meticulous quality.

**Usage:**
```bash
node scripts/batch-regenerate-avatars.mjs
```

**Progress:** Writes to `/tmp/batch-regen-progress.json`. Resumable — already-processed authors are skipped. Also accessible via Admin Console → AI → Batch Regeneration section.

---

### `batch-scrape-covers.mjs`

Scrapes Amazon for book cover images for all books missing a `coverImageUrl`, then mirrors all pending covers to S3.

**When to run:** After importing new books from Google Drive that don't have cover images yet.

**Usage:**
```bash
node scripts/batch-scrape-covers.mjs
```

---

### `detect-duplicates.mjs`

Scans the `author_profiles` and `book_profiles` tables for duplicate entries (same base name with different suffixes, e.g. "Adam Grant" and "Adam Grant - Psychology").

**When to run:** After a library regeneration from Google Drive, to check for new duplicates before they appear in the UI.

**Usage:**
```bash
node scripts/detect-duplicates.mjs
```

---

### `remove-duplicates.mjs`

Removes duplicate author and book entries identified by `detect-duplicates.mjs`. Keeps the entry with the most enriched data.

**When to run:** After reviewing the output of `detect-duplicates.mjs`.

**Usage:**
```bash
node scripts/remove-duplicates.mjs
```

---

## Historical Migrations (already applied — do not re-run)

### `fix-alan-dib-covers.mjs`

**Applied:** March 22, 2026

Fixed incorrect book cover URLs for Alan Dib's books:
- "Lean Marketing" — replaced Google Books placeholder with correct Amazon cover
- "The 1-Page Marketing Plan" — added as a new book entry (was missing from DB)

Both covers were mirrored to S3 CDN.

---

## Environment

All scripts require `DATABASE_URL` to be set. When running locally, copy `.env` from the project root or set the variable directly:

```bash
export DATABASE_URL="mysql://..."
node scripts/batch-scrape-covers.mjs
```
