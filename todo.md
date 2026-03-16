# Authors & Books Library — TODO

## Completed
- [x] Authors card grid with category filters and search
- [x] Books tab with content-type badges
- [x] Books Audio tab with format badges
- [x] Sidebar with collapsible category filter
- [x] Google Drive folder links on all cards
- [x] Content-type icons (PDF, Binder, DOC, Transcript, etc.)
- [x] Category watermark illustrations on cards
- [x] Mobile-responsive layout
- [x] Cleaned up misplaced audio files from Authors/ and Books/ in Drive
- [x] Taxonomy spec and skill documented
- [x] Backend server enabled (web-db-user upgrade)
- [x] libraryData.ts rebuilt from fresh Drive scan

## In Progress
- [x] Add Papers, Articles, Links as content-type categories under Authors
  - [x] Update CONTENT_TYPE_ICONS and CONTENT_TYPE_COLORS in libraryData.ts
  - [x] Update normalization map in libraryRouter.ts scanner
  - [x] Update Author card in Home.tsx to show Papers/Articles/Links badges (icons wired)
- [x] Add Regenerate Database button to sidebar
  - [x] Wire libraryRouter into appRouter (routers.ts)
  - [x] Add tRPC mutation call in Home.tsx sidebar footer
  - [x] Show progress spinner and result toast

## Next Steps (March 2026)
- [x] Fix depth-collapse entries: Alan Dib and Alex Hormozi Transcript DOC/PDF folders in Drive
- [x] Add Last Synced timestamp to sidebar footer
- [x] Clean up Books Audio/ root legacy Audio MP3 and Audible MP3 folders

## Session March 15, 2026
- [x] Fix duplicate CATEGORY_COLORS/ICONS/BG exports in libraryData.ts (TS2451 errors)
- [x] Fix generateLibraryTs to include CONTENT_TYPE_ICONS/COLORS with Papers/Articles/Links
- [x] Fix duplicate author display: deduplicate same-name authors in UI (105 unique from 112 entries)
- [x] Fix duplicate book display: deduplicate same-name books in UI
- [x] Add author photo support on cards (93 golden bokeh headshots generated and integrated)
- [x] Normalize raw folder names (temp, Knowledge Base, Notes, DOC) in UI display
- [x] Save checkpoint and publish

## Session March 15, 2026 — Part 2
- [x] Apply new palette: Yellow #FDB817, Blue #112548, Orange #F4795B, Teal #0091AE, Green #21B9A3
- [x] Switch fonts to Inter Tight (Bold H1, SemiBold H2/H3, Regular body)
- [x] Fix author deduplication: merge book lists from all duplicate entries
- [x] Generate photorealistic author headshots with consistent background color (93 authors, golden bokeh style B)
- [x] Upload headshots to CDN and integrate into author cards
- [x] Save Norfolk AI palette as reusable skill (/home/ubuntu/skills/norfolk-ai-palette/SKILL.md)
- [x] Save checkpoint and publish

## Session March 15, 2026 — Part 3
- [x] Fix duplicate books within author cards (e.g., "Hidden Potential" x2 under Adam Grant)
- [x] Validate and deliver person-headshot-generator skill
- [x] Save checkpoint

## Session March 15, 2026 — Part 4
- [x] Add author_profiles DB table (bio, websiteUrl, twitterUrl, linkedinUrl) with tRPC procedures
- [x] LLM-powered author bio + website enrichment (auto-triggered on first bio panel open)
- [x] Sort By control: Authors tab (Name A→Z, Name Z→A, Most Books, Category)
- [x] Sort By control: Books tab (Title A→Z, Title Z→A, Author, Most Content)
- [x] Book detail slide-out drawer (content type list with Drive links, file counts, stats)
- [x] Author bio panel: photo, bio, website/Twitter/LinkedIn links, book list
- [x] "View bio & links" button on every author card
- [x] 38 vitest tests passing (3 test files)
- [x] Save checkpoint

## Session March 15, 2026 — Part 5 (Batch Enrich Bios)
- [x] Add enrichAllBios state machine (idle/running/done/error) to Home component
- [x] Add "Enrich All Bios" button to sidebar footer with progress bar
- [x] Process authors in batches of 10 sequentially, updating progress after each batch
- [x] Show count of enriched/total with NCG yellow progress bar
- [x] Reuses existing enrichBatch tRPC procedure (batches of 10, skips fresh profiles)
- [x] 60 vitest tests passing (4 test files)
- [x] Save checkpoint

## Session March 15, 2026 — Part 6 (Enrichment Indicators)
- [x] Add getAllEnrichedNames tRPC procedure (lightweight single query, returns only names with non-empty bio)
- [x] Fetch enriched names on page load, build enrichedSet (Set<string>) in useMemo
- [x] Show green UserCheck icon + "Bio ready" text on enriched author cards
- [x] Show Users icon + "View bio & links" on un-enriched cards
- [x] Invalidate enrichedNames query after Enrich All Bios completes (reactive update)
- [x] 65 vitest tests passing (4 test files)
- [x] Save checkpoint

## Session March 15, 2026 — Part 7 (Author Bio Modal)
- [x] Replace AuthorBioPanel Sheet with a centered Dialog modal (max-w-lg, 85vh scrollable)
- [x] Make the full author card header clickable (not just the bio button)
- [x] Modal shows: large photo (80px), category pill, name, specialty, bio, links, book list
- [x] LLM enrichment still triggers on first open if bio not yet cached
- [x] Drive link stays accessible as icon in top-right of card header
- [x] 69 vitest tests passing (4 test files)
- [x] Save checkpoint

## Session March 15, 2026 — Part 8 (Books Enrichment — Real Data)
- [x] Add book_profiles DB table (summary, coverUrl, amazonUrl, goodreadsUrl, keyThemes, rating, enrichedAt)
- [x] Add tRPC procedures: get, getMany, getAllEnrichedTitles, enrich, enrichBatch
- [ ] Fetch book covers from Google Books API (by title + author search, store coverUrl in DB)
- [ ] Fetch author bios from Wikipedia API (structured, reliable, free — replace LLM generation)
- [ ] Fetch author website URLs from Wikipedia/Wikidata
- [ ] Update server enrichment procedures to use real sources
- [ ] Integrate book covers into BookCard UI (cover thumbnail on left or top)
- [ ] Build Book Detail Dialog modal (cover, summary, key themes, Amazon/Goodreads links, content types)
- [ ] Add enrichment status indicator on book cards
- [ ] Add "Enrich All Books" button to sidebar with progress bar
- [ ] Run tests and save checkpoint

## Session March 15, 2026 — Theme Switcher
- [x] Add Noir Dark Executive CSS theme variables to index.css
- [x] Extend theme context to support named themes (norfolk-ai, noir-dark)
- [x] Build Preferences panel in sidebar with theme toggle
- [x] Persist theme selection to localStorage
- [x] Audit all UI components to use CSS token classes (no hardcoded colors)
- [x] Test both themes in browser — cards, chart, modals, sidebar, badges, buttons

## Session March 15, 2026 — Noir Monochrome Redesign
- [ ] Rewrite Noir CSS variables: white bg, black fg, grey surfaces, black borders
- [ ] Round-rectangular buttons: active = black fill + white text, inactive = white + black border
- [ ] Duotone Lucide icons: black primary stroke + light grey secondary fill in Noir theme
- [ ] Sidebar in Noir: white bg, black text, black active pill, grey hover
- [ ] Cards in Noir: white bg, black border (1px), no category pastel bg, no left-color border
- [ ] Category pills in Noir: black active, grey inactive, rounded-full
- [ ] Category chart in Noir: black bars, grey grid lines, black labels
- [ ] Modals in Noir: white bg, black headings, grey dividers
- [ ] Stat cards in Noir: white bg, black numbers, grey labels
- [ ] Remove all color accents except from avatars/covers in Noir
- [ ] Verify both themes render correctly in browser

## Session March 15, 2026 — Remove Manus Branding
- [x] Remove Manus logo and name from app header/sidebar
- [x] Remove "Powered by Manus" or any Manus references in UI
- [x] Replace with NCG Library identity (name, logo placeholder)
- [x] Add "Powered by Norfolk AI" to login dialog and sidebar footer

## Session March 15, 2026 — Perplexity Photo & Cover Research
- [ ] Identify all authors missing headshots
- [ ] Identify all books missing covers
- [ ] Use Perplexity API to find photo URLs for missing authors
- [ ] Use Perplexity API to find cover URLs for missing books
- [ ] Download images and upload to Drive + CDN
- [ ] Update authorPhotos.ts and bookProfiles DB with new URLs

## Session March 15, 2026 — Apply Manus/Delano Swiss Modernist Theme
- [x] Extract theme from L+B Hospitality (Delano Hotel Room Design App)
- [x] Add IBM Plex Sans + Inter + JetBrains Mono font imports to index.html
- [x] Rewrite index.css with Swiss Modernist design system (Manus theme)
- [x] Update ThemeContext to use standard light/dark classes (remove norfolk-ai/noir-dark)
- [x] Fix all Home.tsx theme references to use new light/dark values
- [x] Verify 90 tests still pass after theme migration

## Session March 15, 2026 — Swiss Modernist Typography Hierarchy
- [x] Apply font-display class to all stat numbers in StatCard
- [x] Apply font-display class to all card titles (author names, book titles)
- [x] Apply font-display class to section headings and modal titles
- [x] Apply font-display class to sidebar header and category labels

## Session March 16, 2026 — Apify Web Scraping Integration
- [x] Install apify-client npm package
- [x] Store APIFY_API_TOKEN as environment secret
- [x] Validate token and confirm cheerio-scraper works for Amazon book search
- [x] Build server/apify.ts helper with scrapeAmazonBook() and scrapeAuthorPhoto() functions
- [x] Add apify tRPC router with scrapeBook and scrapeAuthor procedures
- [x] Wire apify router into appRouter
- [ ] Add "Scrape from Amazon" button to book detail panel
- [ ] Add "Find Real Photo" button to author bio modal
- [x] Write vitest tests for Apify helper (15 tests, 105 total passing)

## Session March 16, 2026 — Preferences System & Theme Skill
- [x] Audit current ThemeContext and AppSettings state
- [x] Build AppSettingsContext (theme + iconSet, persisted to localStorage)
- [x] Add Manus theme CSS variables (.theme-manus class) to index.css
- [x] Fix Noir Dark theme: white background, black/dark accents, black selected buttons with white font
- [x] Enforce rounded-rectangle buttons globally across all themes (border-radius: 6px)
- [x] Build Preferences page with tabs: Themes, Icons, About
- [x] Themes tab: theme cards (Manus default | Norfolk AI | Noir Dark), color hierarchy display
- [x] Icons tab: icon set selector (Phosphor Regular | Phosphor Duotone) with live preview
- [x] Add Preferences entry to sidebar navigation
- [x] Set Manus as the default theme on first load
- [x] Create webdev-theme-system skill documenting the full pattern

## Session March 16, 2026 — Breadcrumbs & Theme-Aware Cards
- [x] Build reusable PageHeader component with breadcrumb trail and Home button
- [x] Add PageHeader to Preferences page (/preferences)
- [x] Add PageHeader to NotFound page (/404)
- [x] Audit all card background classes in Home.tsx — replace hardcoded colors with bg-card / bg-background
- [x] AuthorCard, BookCard, AudioCard now use useAppSettings().settings.theme for isNoir check
- [x] Noir Dark theme strips all category tints (clean white bg-card)
- [x] Manus and Norfolk AI themes keep soft category-tinted pastels
- [x] 105 tests passing

## Session March 16, 2026 — Card Theme Fix + Home Button + Amazon Scrape
- [ ] Remove all hardcoded category-tinted card backgrounds (CATEGORY_BG pastels) — use only bg-card
- [ ] Ensure category accent color is shown only via the left border stripe, not the card fill
- [ ] Add persistent Home button to PageHeader (top-left, visible on all non-home pages)
- [ ] Add Home button to sidebar footer as a navigation shortcut
- [ ] Wire trpc.apify.scrapeBook mutation into book detail drawer with loading state and toast feedback
- [ ] Show scraped cover image immediately in the drawer after successful scrape
- [ ] Save Amazon URL to bookProfiles DB after scrape

## Session March 16, 2026 — S3 Mirror for Book Covers & Author Photos
- [x] Add s3CoverUrl/s3CoverKey columns to book_profiles table
- [x] Add s3PhotoUrl/s3PhotoKey columns to author_profiles table
- [x] Push DB migration
- [x] Build server/mirrorToS3.ts: fetch external URL → upload to S3 → return CDN URL
- [x] Add bookProfiles.mirrorCovers tRPC procedure (batch, with stats query)
- [x] Add authorProfiles.mirrorPhotos tRPC procedure (batch, with stats query)
- [x] Update bookCoverMap in Home.tsx to prefer s3CoverUrl over external coverUrl
- [x] Add "Mirror Covers" and "Mirror Photos" buttons in sidebar footer with status indicators
- [x] Fix context consolidation: AppSettingsContext absorbs ThemeContext, no stale useTheme errors
- [x] 105 tests still passing

## Session March 16, 2026 — Custom Author Avatar Upload
- [x] Add uploadAuthorPhoto tRPC mutation (multipart base64 → S3 → DB)
- [x] Build AvatarUpload component with click-to-upload overlay on author photo
- [x] Wire AvatarUpload into AuthorCard and author bio modal
- [x] Write vitest tests for uploadAuthorPhoto

## Session March 16, 2026 — Avatar Crop & Resize Editor
- [x] Install react-image-crop package
- [x] Build AvatarCropModal component with circular crop preview and zoom slider
- [x] Integrate crop modal into AvatarUpload: show before S3 upload
- [x] Export cropped canvas as JPEG blob, convert to base64 for uploadPhoto mutation
