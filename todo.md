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

## Session March 16, 2026 — Apify Amazon Scraper in Book Detail Drawer
- [x] Review book detail drawer and Apify router integration points
- [x] Add "Scrape from Amazon" button to book detail drawer with loading state
- [x] Show scraped cover image immediately in drawer after successful scrape
- [x] Show scraped rating and Amazon URL in drawer
- [x] Persist scraped cover URL and Amazon URL to book_profiles DB
- [x] Update bookCoverMap to reflect newly scraped cover (invalidate query)
- [x] 118 tests passing

## Session March 16, 2026 — Mini Book Covers on Author Cards
- [x] Add mini book cover strip to AuthorCard (horizontal row of small thumbnails)
- [x] Use bookCoverMap to resolve cover URLs per book title
- [x] Show fallback placeholder (category-colored icon) when no cover available
- [x] Clicking a cover opens the book's Google Drive folder directly

## Session March 16, 2026 — Cover Thumbnails Open Book Detail Dialog
- [x] Add onBookClick callback prop to AuthorCard
- [x] Wire cover thumbnails to call onBookClick(BookRecord) instead of linking to Drive
- [x] Build booksByIdMap lookup map to resolve BookRecord from book.id
- [x] Pass onBookClick from parent (Home) that calls setSelectedBook + setBookSheetOpen

## Session March 16, 2026 — Replicate Portrait Generation for Missing Authors
- [x] Build server/replicate.ts helper with generateAuthorPortrait(authorName, bio?) function
- [x] Add authorProfiles.generatePortrait tRPC procedure (calls Replicate, mirrors to S3, saves s3PhotoUrl)
- [x] Add "Generate Portrait" button (Sparkles icon) to author bio modal (shown only when no real photo exists)
- [x] Show loading spinner during generation, toast on success/error
- [x] Display generated portrait immediately on success (optimistic state update)
- [x] Write vitest tests for Replicate helper (6 tests, 111 total passing)
- [x] Save checkpoint

## Session March 16, 2026 — Batch AI Portrait Generation
- [x] Detect missing authors client-side (names not in AUTHOR_PHOTOS static map)
- [x] Reuse generatePortrait tRPC mutation (single author, called sequentially from client)
- [x] Add "Generate Missing Portraits" button to sidebar footer
- [x] Show progress bar: X / Y authors processed, current author name
- [x] Sequential processing with 2s delay between requests (Replicate rate limit)
- [x] Show success/error count in completion toast
- [x] Write 7 vitest tests for batch portrait logic (118 total passing)
- [x] Save checkpoint

## Session March 16, 2026 — Norfolk AI Logo in Sidebar Footer
- [x] Upload all three logo variants (white, wireframe, blue) to CDN
- [x] Replace plain-text "Powered by Norfolk AI" with logo image in sidebar footer
- [x] Use blue logo on light theme, white logo on dark theme
- [x] Save checkpoint

## Session March 16, 2026 — Three Feature Bundle
- [x] Upload Norfolk AI logos to CDN and replace plain-text branding with logo in sidebar footer
- [x] Add "Scrape from Amazon" button to book detail drawer (cover, rating, ASIN, Amazon URL)
- [x] Wire cover thumbnails on author cards to open book detail dialog (not Drive folder)
- [x] Add DB-first photo fallback: check author_profiles.s3PhotoUrl before static AUTHOR_PHOTOS map
- [x] 118 tests passing
- [x] Save checkpoint

## Session March 16, 2026 — Amazon Badge + Motion System + Rename
- [x] Rename "NCG Library" → "Ricardo Cidale's Library" in all UI text, page title, sidebar header, breadcrumb, comments (15 occurrences)
- [x] Add comprehensive motion CSS to index.css (card lift, watermark 3D spin, cover zoom, strip scroll, search glow, tab entrance, stat pop, button press, Norfolk pulse, Amazon badge)
- [x] Apply card-lift + group to AuthorCard, BookCard, AudioCard
- [x] Apply watermark-icon class to all three card watermark divs
- [x] Apply cover-strip-scroll class to author card cover strip
- [x] Add cover-zoom-wrap around BookCard cover image
- [x] Add Amazon badge (orange pill, slide-up entrance) to BookCard with amazonUrlMap prop
- [x] Add stat-number class to StatCard value spans
- [x] Add search-glow class to search input wrapper
- [x] Add tab-content-enter class to tab content panels with key={activeTab}
- [x] Add norfolk-logo-pulse class to Norfolk AI logo wrapper
- [x] Implement 3D mouse-tracking tilt on AuthorCard (useRef + mousemove, no external library)
- [x] Create webdev-motion-system skill (validated)
- [x] Update webdev-norfolk-ai-branding skill with real logo CDN URLs and pulse pattern
- [x] 118 tests passing
- [x] Save checkpoint

## Session March 16, 2026 — Cover Expand Tooltip on Mini Thumbnails
- [x] Wrap each mini cover thumbnail in Radix Tooltip with enlarged 90×126px cover image
- [x] Show book title as caption below the enlarged cover in the tooltip
- [x] Show placeholder with book icon when no cover URL available
- [x] Save checkpoint (completed in previous session 621d90cd)

## Session March 16, 2026 — Ricardo Cidale Avatar
- [x] Upload ricardocidalecartoon.png to CDN (https://d2xsxph8kpxj0f.cloudfront.net/...)
- [x] Set avatar as VITE_APP_LOGO (built-in secret; hardcoded CDN URL in sidebar header instead)
- [x] Add avatar to sidebar header next to library name (rounded-full, ring-2 ring-primary/20)
- [x] Use avatar as favicon (favicon.ico in client/public + CDN PNG link in index.html)
- [x] Save checkpoint

## Session March 16, 2026 — Fix Portrait Generation + Confetti + 3D Effects
- [x] Diagnose Replicate portrait generation failure (10/10 failing) — FileOutput SDK change
- [x] Fix portrait generation — .toString() on FileOutput, confirmed working
- [x] Add confetti on: single portrait generated, batch portraits done, batch enrichment done, Amazon scrape success, mirror covers/photos done
- [x] Audit current 3D/motion effects and identified gaps
- [x] Run tests and save checkpoint

## Session March 16, 2026 — Confetti + 3D Effects (Implementation)

- [x] Wire confetti "portrait" mode to single portrait generation success
- [x] Wire confetti "enrich" mode to batch author bio enrichment completion
- [x] Wire confetti "enrich" mode to batch book enrichment completion
- [x] Wire confetti "batch" mode to batch portrait generation completion
- [x] Wire confetti "scrape" mode to Amazon scrape success in BookDetailPanel
- [x] Wire confetti "enrich" mode to mirror covers/photos completion in Preferences.tsx
- [x] Wire confetti "batch" mode to avatar generation completion in Preferences.tsx
- [x] Add 3D mouse-tracking tilt to BookCard (perspective 700px, rotateY 10deg, rotateX 8deg)
- [x] Add 3D mouse-tracking tilt to AudioCard (same pattern)
- [x] Add floating/bob animation to sidebar avatar (Ricardo Cidale) — avatar-bob CSS
- [x] Add 3D depth shadow + hover to StatCards — stat-card-3d CSS
- [x] Add 3D perspective tilt to book cover in BookDetailPanel — book-cover-3d CSS
- [x] Add 3D perspective tilt to author avatar in AuthorBioPanel — author-avatar-3d CSS
- [x] Add 3D mouse-tracking tilt to ThemeCard and IconSetCard in Preferences — pref-card-3d CSS
- [x] Add animated gradient shimmer to progress bars while running — progress-shimmer CSS
- [x] Add sparkle-spin animation to the "Generate AI Portrait" Sparkles icon
- [x] 118 tests passing
- [x] Save checkpoint

## Session March 16, 2026 — Card Mouse-Tracking Tilt + Scale + Avatar Expand
- [x] Fix overflow-hidden clipping: two-layer structure on all 3 card types (outer wrapper handles transform, inner div/anchor keeps overflow-hidden)
- [x] AuthorCard: perspective(800px) rotateY(12deg) rotateX(10deg) scale(1.06) translateZ(10px) on hover
- [x] BookCard: same two-layer fix and scale-up/spring-back hover
- [x] AudioCard: same two-layer fix (outer div + inner anchor)
- [x] Dynamic box-shadow on hover: 0 20px 60px -10px rgba(0,0,0,0.22) + z-index:20
- [x] Spring-back easing on mouse leave: cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s
- [x] Author card avatars: graceful 2x scale expand on hover (scale(2), spring easing, category-colored drop-shadow, z-index:50)
- [x] 118 tests passing
- [x] Save checkpoint

## Session March 16, 2026 — LLM Model Selector in Preferences
- [x] Fetched 13 text-generation Gemini models from Google AI API (live)
- [x] Add LLM tab to Preferences page with radio buttons grouped by tier (Preview / Stable / Latest)
- [x] Persist selected model to localStorage via AppSettingsContext (geminiModel field)
- [x] Add llm.router.ts with listModels query and testModel mutation (latency ping)
- [x] Add optional model param to invokeLLM helper so callers can override default
- [x] Show model descriptions (context window, output limit, speed, model ID) per option
- [x] Add "Test selected model" button with latency display and success/error feedback
- [x] 118 tests passing
- [x] Save checkpoint
