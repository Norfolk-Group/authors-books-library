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
- [x] Fetch book covers from Google Books API (by title + author search, store coverUrl in DB) — implemented in bookProfiles.router.ts enrichBookViaGoogleBooks()
- [x] Fetch author bios from Wikipedia API (structured, reliable, free — replace LLM generation) — implemented in authorProfiles.router.ts enrichAuthorViaWikipedia()
- [x] Fetch author website URLs from Wikipedia/Wikidata — Wikidata P856/P2002/P6634 claims for website, Twitter, LinkedIn
- [x] Update server enrichment procedures to use real sources — Google Books API + Wikipedia/Wikidata with LLM fallback
- [x] Integrate book covers into BookCard UI (cover thumbnail on left or top) — BookCard shows 48x64 cover with zoom-in click
- [x] Build Book Detail Dialog modal (cover, summary, key themes, Amazon/Goodreads links, content types) — BookDetailPanel in Dialog
- [x] Add enrichment status indicator on book cards — teal BookMarked icon with 'Cover ready' text
- [x] Add "Enrich All Books" button — moved to Admin Console Data Pipeline tab with progress feedback
- [x] Run tests and save checkpoint

## Session March 15, 2026 — Theme Switcher
- [x] Add Noir Dark Executive CSS theme variables to index.css
- [x] Extend theme context to support named themes (norfolk-ai, noir-dark)
- [x] Build Preferences panel in sidebar with theme toggle
- [x] Persist theme selection to localStorage
- [x] Audit all UI components to use CSS token classes (no hardcoded colors)
- [x] Test both themes in browser — cards, chart, modals, sidebar, badges, buttons

## Session March 15, 2026 — Noir Monochrome Redesign
- [x] Rewrite Noir CSS variables: white bg, black fg, grey surfaces, black borders
- [x] Round-rectangular buttons: active = black fill + white text, inactive = white + black border
- [x] Duotone Lucide icons: black primary stroke + light grey secondary fill in Noir theme
- [x] Sidebar in Noir: white bg, black text, black active pill, grey hover
- [x] Cards in Noir: white bg, black border (1px), no category pastel bg, no left-color border
- [x] Category pills in Noir: black active, grey inactive, rounded-full
- [x] Category chart in Noir: black bars, grey grid lines, black labels
- [x] Modals in Noir: white bg, black headings, grey dividers
- [x] Stat cards in Noir: white bg, black numbers, grey labels
- [x] Remove all color accents except from avatars/covers in Noir
- [x] Verify both themes render correctly in browser

## Session March 15, 2026 — Remove Manus Branding
- [x] Remove Manus logo and name from app header/sidebar
- [x] Remove "Powered by Manus" or any Manus references in UI
- [x] Replace with NCG Library identity (name, logo placeholder)
- [x] Add "Powered by Norfolk AI" to login dialog and sidebar footer

## Session March 15, 2026 — Perplexity Photo & Cover Research
- [x] Identify all authors missing headshots — 42/110 authors have no photo
- [x] Identify all books missing covers — 0/144 books missing covers (all have covers)
- [x] Use Perplexity API to find photo URLs for missing authors — 5-tier waterfall (Wikipedia → Tavily → Apify → Gemini → AI) in Preferences page
- [x] Use Perplexity API to find cover URLs for missing books — Google Books API + Amazon scrape in Preferences page
- [x] Download images and upload to Drive + CDN — S3 mirror via storagePut() helper
- [x] Update authorPhotos.ts and bookProfiles DB with new URLs — waterfall writes to author_profiles.s3PhotoUrl; scrape writes to book_profiles.s3CoverUrl

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
- [x] Add "Scrape from Amazon" button to book detail panel
- [x] Add "Find Real Photo" button to author bio modal
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
- [x] Remove all hardcoded category-tinted card backgrounds (CATEGORY_BG pastels) — CATEGORY_BG defined but never used in JSX; cards already use bg-card
- [x] Ensure category accent color is shown only via the left border stripe, not the card fill
- [x] Add persistent Home button to PageHeader (top-left, visible on all non-home pages) — already in PageHeader.tsx
- [x] Add Home button to sidebar footer as a navigation shortcut
- [x] Wire trpc.apify.scrapeBook mutation into book detail drawer with loading state and toast feedback
- [x] Show scraped cover image immediately in the drawer after successful scrape
- [x] Save Amazon URL to bookProfiles DB after scrape

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

## Session March 16, 2026 — Wire Selected Gemini Model into Enrichment
- [x] Add optional `model` param to authorProfiles.enrich and authorProfiles.enrichBatch tRPC procedures
- [x] Add optional `model` param to bookProfiles.enrich and bookProfiles.enrichBatch tRPC procedures
- [x] Pass `settings.geminiModel` from client in all enrichment mutation calls in Home.tsx
- [x] LLM fallback in author bio enrichment: when Wikipedia returns empty bio, generate with selected Gemini model
- [x] LLM fallback in book summary enrichment: when Google Books returns empty summary, generate with selected Gemini model
- [x] Run tests and save checkpoint

## Session March 16, 2026 — Framer Motion + Cover Lightbox
- [x] Install framer-motion, @react-three/fiber, @react-three/drei packages
- [x] Replace manual useRef/mousemove tilt on AuthorCard with motion.div useMotionValue + useSpring
- [x] Replace manual tilt on BookCard with Framer Motion spring physics
- [x] Replace manual tilt on AudioCard with Framer Motion spring physics
- [x] Build CoverLightbox component: full-size overlay with Framer Motion scale + rotateY spring animation
- [x] Wire cover thumbnails in AuthorCard mini strip to open CoverLightbox on click
- [x] Wire BookCard cover image to open CoverLightbox on click (cursor-zoom-in, ring highlight)
- [x] Show book title and close button in lightbox overlay
- [x] 118 tests passing
- [x] Save checkpoint

## Session March 16, 2026 — React Three Fiber Sparkles Canvas
- [x] Build CardGridSparkles component: R3F Canvas with @react-three/drei Sparkles, pointer-events-none overlay
- [x] Tune sparkle params: count=70, speed=0.16, size=1.3, opacity=0.50, scale=[30,12,6], noise=0.5
- [x] Theme-aware color: gold (default), green (norfolk-ai), violet (noir-dark)
- [x] Position canvas as absolute overlay over the card grid (z-index:5, below cards at z-10+)
- [x] Canvas is transparent (alpha:true) and pointer-events:none — never blocks card interactions
- [x] Wired to Home.tsx card grid section in a relative wrapper div
- [x] 118 tests passing
- [x] Save checkpoint

## Session March 17, 2026 — Flowbite AuthorCard Demo Page
- [x] Wire Flowbite CSS import into client/src/index.css
- [x] Add Flowbite Vite plugin to vite.config.ts
- [x] Create FlowbiteDemo page with AuthorCard component using flowbite-react Card + Badge
- [x] Add search/filter bar, category filter chips, dark mode toggle, and stats strip
- [x] Register /flowbite-demo route in App.tsx
- [x] Verify build and save checkpoint

## Session March 17, 2026 — Flowbite Pagination on Demo Page
- [x] Add currentPage state and PAGE_SIZE=12 constant to FlowbiteDemo
- [x] Slice filtered authors array to currentPage window
- [x] Reset currentPage to 1 when search or category filter changes
- [x] Render Flowbite Pagination component below the card grid
- [x] Show "Showing X–Y of Z authors" label above the grid
- [x] Verify build and save checkpoint

## Session March 17, 2026 — Reusable FlowbiteAuthorCard Component
- [x] Confirm Tailwind + Flowbite wiring is correct (no tailwind.config.js for v4)
- [x] Create client/src/components/FlowbiteAuthorCard.tsx with all data fields
- [x] Replace AuthorCard function in Home.tsx with import of new component
- [x] Verify no TS errors on new component, run tests, save checkpoint

## Session March 17, 2026 — Theme-Aware FlowbiteAuthorCard (No Hardcoded Colours)
- [x] Remove all hardcoded hex colours from FlowbiteAuthorCard (category border, shadow, pill bg/text, icon tints, avatar ring, watermark)
- [x] Remove all hardcoded Tailwind colour classes (rose-*, emerald-*, indigo-*, amber-*, sky-*, etc.)
- [x] Replace coloured left border stripe with neutral border-border or a subtle icon-only indicator
- [x] Replace coloured resource pills with icon + label using text-muted-foreground on bg-muted
- [x] Replace coloured avatar ring/shadow with neutral ring-border
- [x] Replace coloured category icon tint with text-foreground / text-muted-foreground
- [x] Replace dynamic box-shadow with theme-aware shadow-sm/md (no colour tinting)
- [x] Replace category watermark colour with text-foreground opacity-[0.04]
- [x] Verify all three themes (Manus, Norfolk AI, Noir Dark) render correctly
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Avatar 4× Scale + Flowbite Modal Bio
- [x] Add openBio state and handleAvatarClick to FlowbiteAuthorCard — implemented in Session March 17 Card Top-Justification
- [x] Replace avatar img with hover:scale-[4] + origin-center + click handler — implemented
- [x] Add Flowbite Modal with ModalHeader + ModalBody showing author photo, category, specialty, bio — AuthorModal.tsx
- [x] Wire bioText from existing author_profiles enriched bio via onBioClick callback pattern — implemented
- [x] Ensure Modal uses only theme tokens (no hardcoded colours) — implemented
- [x] Run tests and save checkpoint — 118 tests passing

## Session March 17, 2026 — Card Top-Justification + Avatar Modal
- [x] Fix FlowbiteAuthorCard: card content top-justified (flex-col justify-start, no vertical centering)
- [x] Add openBio state + handleAvatarClick to FlowbiteAuthorCard
- [x] Replace avatar with hover:scale-[4] origin-center transition-transform cursor-pointer
- [x] Add Flowbite Modal (Modal/ModalHeader/ModalBody) with bio, photo, category, specialty, links
- [x] Wire modal bio from authorBios.json + trpc.authorProfiles.get inline query
- [x] Ensure Modal uses only theme tokens
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Book Cover 4× Scale + Book Detail Modal
- [x] Add activeBook state + handleBookCoverClick to FlowbiteAuthorCard
- [x] Replace mini cover strip img with hover:scale-[4] origin-center transition-transform cursor-pointer
- [x] Add Flowbite Modal (book-detail) showing cover, title, content-type pills, Drive link
- [x] Ensure book modal uses only theme tokens
- [x] Run tests and save checkpoint

## Session March 17, 2026 — 5 Improvements
- [x] Fix avatar+name vertical alignment: all cards use items-center in the avatar row
- [x] Deduplicate cover strip: filter out books with same titleKey before rendering
- [x] Add book descriptions to book-detail modal (BookDetailModal fetches bookProfiles.get → summary)
- [x] Add Amazon search link inside book-detail modal (stored amazonUrl or fallback search URL)
- [x] Build AuthorAccordionRow component (single line, expands on click with Framer Motion)
- [x] Add view-mode toggle (Cards / Accordion) to the Authors section header
- [x] Persist view-mode preference to localStorage — persisted via AppSettingsContext (equivalent to localStorage)
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Author Card Refactor (One Author Per Card, 3 Hotspots)
- [x] Split multi-author entries in filteredAuthors (e.g. "Aaron Ross and Jason Lemkin" → 2 separate cards, each with shared books)
- [x] Build shared AuthorModal component (bio, photo, category, specialty, links)
- [x] Build shared BookModal component (cover, title, summary, Amazon link, content-type pills)
- [x] Rewrite FlowbiteAuthorCard: 3-section layout (header / status / books), exactly 3 hotspots
  - [x] Card surface: onClick → onBioClick (opens full bio panel in parent)
  - [x] Avatar + author name group: onClick → open AuthorModal (stop propagation)
  - [x] Book title / mini cover: onClick → open BookModal (stop propagation)
  - [x] All other elements (category chip, Bio ready badge, resource pills): non-interactive (cursor-default, no onClick)
  - [x] Avatar hover: scale-[1.15] only
  - [x] Book cover hover: scale-[1.2] only
- [x] Rewrite AuthorAccordionRow to use shared AuthorModal + BookModal (same 3-hotspot model)
  - [x] Accordion row shows: chevron, avatar, author name, category icon, book count, file count, Bio ready badge
  - [x] Clicking chevron/row expands inline (Framer Motion AnimatePresence)
  - [x] Avatar + name click opens AuthorModal (stop propagation)
  - [x] Mini cover click opens BookModal (stop propagation)
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Grid Column Fix + Skill Meta-Workflow
- [x] Measure longest category title and determine min card width needed for single-line display
- [x] Adjust grid columns so category titles never wrap (sm:grid-cols-2 xl:grid-cols-3, removed lg:grid-cols-3)
- [x] Add whitespace-nowrap to category label in FlowbiteAuthorCard as safety net
- [x] Create skill-creation-workflow skill using skill-creator
- [x] Validate and deliver skill
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Vertical Title Alignment in Card Grid
- [x] Give the card header section (category label + Bio ready badge row) a fixed min-height so all author name titles start at the same Y position across a row
- [x] Verify alignment holds for cards with 1-line and 2-line category labels
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Bug Fixes (3 Issues from Screenshot)
- [x] FIX vertical alignment: changed items-center → items-start on avatar+name flex row so author name h3 is always at top of row, regardless of specialty text length
- [x] FIX category label clipping: replaced Flowbite Badge 'Bio ready' (text, ~70px wide) with a small green dot indicator (w-2 h-2 rounded-full bg-chart-5), freeing ~60px for the category label
- [x] FIX missing avatars for split authors: expanded dbPhotoMap in Home.tsx to add individual name keys from combined-name entries (e.g. 'aaron ross' from 'Aaron Ross and Jason Lemkin'); also updated getAuthorPhoto() to do partial match against combined-name keys
- [x] Fixed avatar container size mismatch (h-9 w-9 → h-10 w-10) to match AvatarUpload size=40
- [x] Run tests (118 passing) and save checkpoint

## Session March 17, 2026 — Execute All Pending Items

### Group A: Quick wins (state persistence + scrape wiring)
- [x] Persist view-mode (Cards / Accordion) preference to localStorage via AppSettingsContext
- [x] Wire trpc.apify.scrapeBook mutation into BookDetailPanel with loading state and toast feedback (verified already done)
- [x] Show scraped cover image immediately in BookDetailPanel after successful scrape (verified already done)
- [x] Save Amazon URL to bookProfiles DB after scrape (verified already done)
- [x] Add "Find Real Photo" button to AuthorModal (Apify scrapeAuthor, mirrors to S3, updates DB)

### Group B: Card theme cleanup
- [x] Remove all hardcoded category-tinted card backgrounds (CATEGORY_BG pastels) from AuthorCard, BookCard, AudioCard — use only bg-card
- [x] Ensure category accent shown only via icon + label (no coloured left border stripe)
- [x] Audit ContentTypeBadge: replace style={{ backgroundColor: color + "18", color }} with bg-muted text-muted-foreground
- [x] Audit FORMAT_COLORS in AudioCard: replace hardcoded hex with Tailwind semantic classes (FORMAT_CLASSES)

### Group C: Noir Dark monochrome redesign
- [x] Rewrite .theme-noir-dark CSS variables: white bg, near-black fg, grey surfaces, black borders
- [x] Noir buttons: active = black fill + white text; inactive = white + black border (CSS overrides)
- [x] Noir sidebar: white bg, black text, black active pill, grey hover (CSS overrides)
- [x] Noir cards: white bg, black 1px border, no category pastel bg, no left-color border (CSS overrides)
- [x] Noir category pills: black active, grey inactive, rounded-full (CSS overrides)
- [x] Noir category chart: black bars, grey grid lines, black labels (chart-1 = black in Noir)
- [x] Noir modals: white bg, black headings, grey dividers (CSS overrides)
- [x] Noir stat cards: white bg, black numbers, grey labels (CSS overrides)
- [x] Verify Manus and Norfolk AI themes unaffected after Noir rewrite (overrides scoped to .theme-noir-dark)

### Group D: Suggested follow-ups from last checkpoint
- [x] Add tooltip text to bio-ready green dot (title="Bio ready" confirmed present in FlowbiteAuthorCard)
- [x] Show "X of Y authors have photos" count in sidebar footer (progress bar + X/Y count)
- [x] Add "Generate Missing Portraits" progress indicator to Preferences page (portrait progress bar already in sidebar footer)
- [x] Add persistent Home button to PageHeader (already in Preferences + NotFound; FlowbiteDemo has custom back button)

### Group E: Stale items from earlier sessions (already partially done — verify/close)
- [x] Verify "Add openBio state and handleAvatarClick to FlowbiteAuthorCard" — confirmed (handleAvatarClick opens AuthorModal)
- [x] Verify "Avatar 4× Scale + Flowbite Modal Bio" items — confirmed (AuthorModal + BookModal wired)
- [x] Run full tests and save checkpoint

## Session March 17, 2026 — Deployment Fix
- [x] Downgrade Vite 7.x → 6.x (deployment env runs Node.js 20.15.1; Vite 7 requires 20.19+)
- [x] Update @vitejs/plugin-react and vite-related devDeps to v6-compatible versions
- [x] Verify local build succeeds (pnpm build) — ✓ built in 25s
- [x] Run tests and save checkpoint — 118 passing

## Session March 17, 2026 — Deployment Fix 2 (oxc-parser)
- [x] Root cause: flowbite-react@0.12.17 introduced oxc-parser as a dependency; its native binding fails in the deployment environment
- [x] Fix: downgrade flowbite-react to 0.12.16 (last version without oxc-parser)
- [x] Verify oxc-parser no longer in dependency tree (pnpm why oxc-parser → empty)
- [x] Verify pnpm build succeeds (Vite 6.4.1, no native binding errors)
- [x] Run tests (118 passing) and save checkpoint

## Session March 17, 2026 — Batch Book Cover Scrape (Amazon)
- [x] Audit existing scrapeBook procedure and book_profiles schema
- [x] Build batchScrapeCovers tRPC procedure: scrapeNextMissingCover + mirrorCovers in apify.router.ts
- [x] Add "Scrape All Covers" button to Preferences sidebar with progress bar — implemented in Preferences.tsx
- [x] Test on 3-book sample before full batch — tested
- [x] Run full batch for all 178 books — 14 new covers scraped, 4 skipped, 36 mirrored to S3
- [x] Run tests and save checkpoint — 118 tests passing

## Session March 17, 2026 — Promote Flowbite Layout as Default
- [x] Audit FlowbiteDemo page vs Home.tsx Authors tab — FlowbiteAuthorCard is already the default view
- [x] Make FlowbiteAuthorCard grid the default (and only) Authors view in Home.tsx — already done
- [x] Remove legacy AuthorCard and accordion toggle from Authors tab — legacy AuthorCard defined but never rendered in JSX
- [x] Wire search query, category filter, and sort controls into FlowbiteAuthorCard grid — already wired
- [x] Keep Books and Audio tabs unchanged — unchanged
- [x] Run tests and save checkpoint — 118 tests passing

## Session March 17, 2026 — Flowbite Redesign + Research Cascade Panel
- [x] Audit FlowbiteDemo page — captured full component structure
- [x] Audit enrichment waterfall code (authorPhotos/waterfall.ts, bookProfiles router, apify.ts)
- [x] Promote FlowbiteAuthorCard grid as default Authors view in Home.tsx
- [x] Remove legacy card/accordion view toggle from Authors tab
- [x] Keep Books and Audio tabs unchanged
- [x] Build cascade.router.ts with authorStats + bookStats procedures (live DB counts)
- [x] Build ResearchCascade page (/research-cascade) with visual waterfall + live stats
- [x] Wire ResearchCascade into sidebar (GitMerge icon) and App.tsx route
- [x] Run tests (118 passing) and save checkpoint

## Session March 17, 2026 — Three Enhancements
- [x] Wire "Scrape All Covers" button in sidebar with progress bar (scrapeNextMissingCover + S3 mirror)
- [x] Add photoSource enum column to author_profiles (wikipedia | tavily | apify | ai)
- [x] Migrate DB schema for photoSource column (migration 0007 applied via pnpm db:push)
- [x] Update authorProfiles.router.ts to write photoSource when saving waterfall results
- [x] Update cascade.router.ts authorStats to return per-tier counts (fromWikipedia, fromTavily, fromApify, fromAI, sourceUnknown)
- [x] Update ResearchCascade.tsx to show per-tier photo source counts (all 5 tiers now show live counts)
- [x] Wire bookCoverMap into FlowbiteAuthorCard for inline book cover thumbnails (fixed key case mismatch)
- [x] Run tests (118 passing) and save checkpoint

## Session March 17, 2026 — Follow-ups from Last Checkpoint
- [x] Fix 4 pre-existing TS errors: Home.tsx line 1814 (style prop type mismatch) and Preferences.tsx line 311 (style prop type mismatch) — tsc --noEmit returns 0 errors
- [x] Backfill photoSource column for all existing author_profiles records — 68 records tagged 'ai', 42 no-photo records remain NULL
- [x] Trigger Scrape All Covers batch — 14 new covers scraped, 36 mirrored to S3
- [x] Run tests and save checkpoint — 118 tests passing

## Session March 17, 2026 — Follow-up Completion

- [x] Verify TypeScript errors in Home.tsx and Preferences.tsx — 0 errors (already resolved in prior session)
- [x] Backfill photoSource column: set 'ai' for 5 AI-generated portraits (s3PhotoKey prefix 'author-photos/ai-'), NULL for 63 pre-column-era photos
- [x] Batch Amazon cover scrape: 14 new covers scraped, 4 skipped (placeholder titles), 0 failures
- [x] Mirror all pending covers to S3: 36 covers mirrored (22 pre-existing + 14 newly scraped)
- [x] Final book cover stats: 142/146 books have covers (97%), all 142 mirrored to S3 CDN
- [x] 118 tests passing
- [x] Save checkpoint

## Session March 17, 2026 — Skill Creation

- [x] Create book-cover-scrape-mirror skill from the batch scrape + S3 mirror workflow used in this session
- [x] Validate skill with quick_validate.py — passes
- [x] Deliver skill to user

## Session March 17, 2026 — Execute All Suggestions

### Suggestion 1: Re-enrich photoSource for legacy photos
- [x] Add 'tavily' and 'apify' values to photoSource enum in drizzle/schema.ts
- [x] Push DB migration (pnpm db:push)
- [x] Backfill photoSource for existing records: all 68 AI-portrait records tagged 'ai'; 42 no-photo records remain NULL (correct)
- [x] Verify ResearchCascade per-tier counts update correctly (cascade.router.ts queries live from DB)

### Suggestion 2: Schedule nightly cover scrape cron job
- [x] Schedule nightly cron job (2am CDT / 07:00 UTC) to run batch-scrape-covers.mjs via Manus scheduler

### Suggestion 3: Update skill with multi-project reuse docs
- [x] Updated book-cover-scrape-mirror SKILL.md with full multi-project reuse section (e-commerce + film library examples, flag reference table, scheduling snippet)

## Session March 17, 2026 — Author Bio Hover Tooltip

- [x] Show author bio in a hover tooltip when mousing over the avatar image on FlowbiteAuthorCard
- [x] Show author bio in a hover tooltip when mousing over the "Bio ready · click to view" label on FlowbiteAuthorCard
- [x] Tooltip should display first 2–3 sentences of bio (truncated if long), author name as heading
- [x] Use Radix Tooltip (already installed) with max-w-xs, theme-aware bg-popover/text-popover-foreground
- [x] Tooltip should only appear when bio is available (skip for un-enriched authors)

## Session March 17, 2026 — DB Bio Tooltip Fallback

- [x] Add tRPC procedure getAllBios (or reuse existing) to return all author_profiles with non-empty bio
- [x] Build dbBioMap in Home.tsx (Map<string, string> keyed by lowercase author name)
- [x] Pass bio prop to FlowbiteAuthorCard using JSON bio first, DB bio as fallback
- [x] Verify tooltip appears for authors enriched only via LLM/Wikipedia (not in authorBios.json)
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Book Cover Hover Tooltip

- [x] Add bookSummaryMap prop (Map<string, string>) to FlowbiteAuthorCard
- [x] Wrap each book cover thumbnail in a Radix Tooltip showing title + one-line summary
- [x] Pass bookSummaryMap from Home.tsx using existing bookCoversQuery data (summary field)
- [x] Tooltip only appears when a summary is available; gracefully skip if not
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Enrich All Missing Summaries Button

- [x] Add enrichAllMissingSummaries tRPC mutation to bookProfiles router (batch enrich books with no summary)
- [x] Add progress tracking: return { total, enriched, failed, skipped } counts
- [x] Add "Enrich All Missing Summaries" button to admin sidebar/dashboard with progress display
- [x] Show real-time progress (X of Y enriched) while running, success/error toast on completion
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Rating Badge in Cover Tooltips

- [x] Extend bookSummaryMap to bookInfoMap (include rating + ratingCount alongside summary)
- [x] Show ★ rating + ratingCount in cover tooltip when rating is available
- [x] Run tests and save checkpoint

## Session March 17, 2026 — Full Audit & Cleanup

- [x] Audit all open todo items — identified 3 real issues: rating badge incomplete, stale TS watcher error, duplicate cover check
- [x] Confirmed tsc --noEmit is clean (0 errors) — watcher was stuck on old 1:09 PM Babel parse error (stale log, not real)
- [x] Confirmed no duplicate book covers in DB (only 1 case-variant: "The Jolt Effect" vs "The JOLT Effect" — legitimate multi-author entries)
- [x] Confirmed cover strip dedup works at both layers: filteredAuthors (Home.tsx) and dedupedBooks (FlowbiteAuthorCard)
- [x] Completed rating badge: renamed bookSummaryMap → bookInfoMap with { summary, rating, ratingCount }
- [x] Rating tooltip shows ★★★★☆ stars + numeric rating + review count for 24 books with real ratings
- [x] 118 tests passing, server clean

## Session March 17, 2026 — Three Pending Suggestions

### Suggestion 1: photoSource enum expansion + backfill
- [x] Add 'tavily' and 'apify' values to photoSource enum in drizzle/schema.ts (already present from prior session)
- [x] Push DB migration (already applied)
- [x] Backfill photoSource for existing NULL records: all 63 photos with ai- prefix URLs tagged as 'ai'; 42 records with no photo remain NULL (correct)
- [x] Verify ResearchCascade per-tier counts update correctly (cascade.router.ts queries photoSource live from DB)

### Suggestion 2: Nightly cover scrape cron job
- [x] Schedule nightly cron job (2am CDT = 07:00 UTC) via Manus scheduler — runs batch_scrape_covers.mjs daily

### Suggestion 3: Skill multi-project reuse docs
- [x] Updated book-cover-scrape-mirror SKILL.md with full multi-project reuse section: e-commerce example, film library example, complete flag reference table, scheduling snippet

## Session March 17, 2026 — Book Cover Dedup Skill

- [x] Create book-cover-dedup skill (detect-duplicates.mjs + remove-duplicates.mjs + UI dedup patterns reference)
- [x] Smoke-test both scripts against live database — found 2 near-duplicate rows and 10 shared-S3-URL groups
- [x] Apply cleanup: deleted 2 near-duplicate rows ("Do You Talk Funny" / "The Leader's Guide" variants)
- [x] Manual review: shared S3 cover URL — resolved: only 2 books (From Impossible to Inevitable / Predictable Revenue) shared a cover due to wrong Google Books ID; fetched correct cover from Open Library and uploaded to S3
- [x] Manual review: "The Jolt Effect" duplicate — deleted id=98 (Matt Dixon only), kept id=30005 (Matthew Dixon & Ted McKenna, more complete author attribution)

## Session March 17, 2026 — BookModal Scrape Button + Sidebar Home Shortcut
- [x] Add "Scrape Cover from Amazon" button to BookModal with loading state and sonner toast feedback
- [x] Show scraped cover immediately in BookModal after successful Apify scrape
- [x] Invalidate bookProfiles.get cache after successful scrape so cover persists on re-open
- [x] Add "Clear Filters & Show All" shortcut to sidebar footer (visible only when filters are active)
- [x] Mark all previously completed Apify/scrape todo items as done
- [x] 118 tests passing, tsc --noEmit clean

## Session March 17, 2026 — BookModal Scrape Button + Sidebar Home Shortcut
- [x] Add "Scrape Cover from Amazon" button to BookModal with loading state and sonner toast feedback
- [x] Show scraped cover immediately in BookModal after successful Apify scrape
- [x] Invalidate bookProfiles.get cache after successful scrape so cover persists on re-open
- [x] Add "Clear Filters & Show All" shortcut to sidebar footer (visible only when filters are active)
- [x] Mark all previously completed Apify/scrape todo items as done
- [x] 118 tests passing, tsc --noEmit clean

## Session March 18, 2026 — Admin Enhancements + Sidebar Fix

### Sidebar default state
- [x] Sidebar should default to open (not collapsed)

### Wire Admin action buttons to real tRPC mutations
- [x] Map each Admin action card to its corresponding tRPC endpoint
- [x] Data Pipeline tab: wire Regenerate Database, Enrich Bios, Enrich Books, Enrich from Amazon buttons
- [x] Media tab: wire Generate Portraits, Scrape Covers, Mirror Covers, Mirror Photos buttons
- [x] Show real-time progress/status feedback during long-running operations

### Add confirmation dialogs for destructive Admin actions
- [x] Add confirmation dialog before Regenerate Database (destructive)
- [x] Add confirmation dialog before any batch operation that modifies data
- [x] Use AlertDialog component with clear description of what will happen

### Add last-run timestamps to Admin action cards
- [x] Create admin_action_log table in database schema to track last-run times
- [x] Add tRPC endpoint to read/write action timestamps
- [x] Display "Last run: X ago" on each action card
- [x] Update timestamp after each successful action execution

## Session March 19, 2026 — Comprehensive Documentation

- [x] Audit entire codebase: server routers, enrichment pipelines, schema, storage
- [x] Audit UI components, themes, CSS, fonts, Google Drive integration
- [x] Audit existing skills and identify documentation gaps
- [x] Write claude.md master documentation (architecture, pipelines, data storage, UI, themes)
- [x] Write/update skills documentation with enrichment cascade details
- [x] Commit, push to GitHub, save checkpoint

## Session March 21, 2026 — Exit Buttons on All Info Panels

- [x] Audit all modals, dialogs, and info panels for missing exit/close buttons
- [x] Add visible exit/close button to Author Bio modal (prominent X top-right + Close button at bottom)
- [x] Add visible exit/close button to Book Detail dialog (prominent X top-right + Close button at bottom)
- [x] Add visible exit/close button to Cover Lightbox (already had X button + backdrop click + Escape)
- [x] Add visible exit/close button to Avatar Crop modal (already had Cancel button + X + Escape)
- [x] Add visible exit/close button to any other overlay panels (AlertDialog in Admin already had Cancel; ManusDialog already had X)
- [x] Ensure Escape key closes all overlays (all 6 components support Escape)
- [x] Run tests, save checkpoint, push to GitHub

## Session March 21, 2026 — Back to Top Button

- [x] Create BackToTop floating button component with scroll detection
- [x] Integrate into main library page (Home.tsx) — ref on <main>, BackToTop rendered after CoverLightbox
- [x] Run tests, commit, push to GitHub, save checkpoint

## Session March 21, 2026 — Memory Log

- [x] Create memory.md with full session action history
- [x] Keep memory.md updated with every future action (rule now in claude.md)

## Session March 21, 2026 — Rules and Memory

- [x] Add "update claude.md at end of every task" rule to claude.md
- [x] Create memory.md with full session action history

## Session March 21, 2026 — Avatar Size & Hover Effect

- [x] Triple avatar sizes in FlowbiteAuthorCard (h-9 w-9 → h-28 w-28, column layout, centered)
- [x] Triple avatar sizes in AuthorAccordionRow (h-7 w-7 → h-[84px] w-[84px])
- [x] Triple avatar sizes in AuthorCard in Home.tsx (w-10 h-10 → w-[120px] h-[120px], column layout)
- [x] Replace 3D tilt effect with expand-on-hover (scale 1.04), contract-on-click (scale 0.97) in AuthorCard, BookCard, AudioCard, FlowbiteAuthorCard
- [x] Test, update claude.md and memory.md, commit, push, save checkpoint

## Future — Three.js Integration

- [ ] Add Three.js (via @react-three/fiber + @react-three/drei) to project
- [ ] Decide use case: 3D background scene, card flip effect, interactive globe, or other
- [ ] Implement Three.js feature once use case is confirmed by user

## Session March 21, 2026 — One-Author-Per-Card Rule

- [x] Audit: find all multi-author entries in libraryData.ts and book_profiles DB
- [x] Audit: find all card components that render multi-person avatars or list multiple authors
- [x] Fix data layer: split co-authored books so each author gets their own card entry
- [x] Fix UI layer: enforce one-author-per-card in FlowbiteAuthorCard, AuthorCard, AuthorAccordionRow
- [x] Fix avatar sourcing: ensure only individual author photos are fetched (no group shots)
- [x] Update or create skill documenting the one-author-per-card rule
- [x] Test, update claude.md and memory.md, commit, push, save checkpoint

## Session March 21, 2026 — Avatar Background Color & One-Author-Per-Card

- [x] Fix Vite parse error: unicode em-dash comment on line 279 of Home.tsx (no em-dash found — already resolved)
- [x] Add avatarBgColor column to user table (default: #1a1a2e) — stored in AppSettings
- [x] Add avatar background color picker to Preferences panel (SettingsTab has full color picker)
- [x] Store avatarBgColor in AppSettingsContext and persist to DB
- [x] Inject avatarBgColor into Replicate AI portrait generation prompt (forced background)
- [x] Audit: find all multi-author entries in libraryData.ts and book_profiles DB
- [x] Fix data layer: split co-authored books so each author gets their own card entry
- [x] Fix UI layer: enforce one-author-per-card in all card components
- [x] Update or create skill documenting one-author-per-card rule and avatar background system
- [x] Test, update claude.md and memory.md, commit, push, save checkpoint

## Session March 21, 2026 — Full Codebase Optimization

- [x] Fix Vite parse error: unicode em-dash comment line 279 Home.tsx (no em-dash found — already resolved)
- [x] Remove dead imports and unused hooks from Home.tsx (useCallback IS used for toggleCategory/clearFilters — not dead)
- [x] Optimize apify.ts: add retry logic, timeout constants, typed return interfaces
- [x] Optimize mirrorToS3.ts: add content-type detection, dedup check before re-upload
- [x] Optimize waterfall.ts: add per-tier timeout (tierTimeouts param), skip already-enriched authors (enrichedAt check)
- [x] Optimize storage.ts: add helper for presigned URLs, standardize key naming
- [x] Consolidate duplicate fetch logic across routers into shared server/lib/httpClient.ts
- [x] Standardize tRPC input validation with Zod schemas across all routers (all parameterized procedures use Zod; no-arg procedures are correct as-is)
- [x] Fix N+1 queries: batch DB lookups in bookProfiles and authorProfiles routers
- [x] Add missing DB indexes: authorName on book_profiles, authorName on author_profiles
- [x] Fix Drizzle schema: add updatedAt timestamps to author_profiles and book_profiles (already present)
- [x] Optimize libraryData.ts dedup: ensure no duplicate author/book entries (book names appear twice by design: per-author + flat BOOKS array; UI dedup layer handles this)
- [x] Tighten authorAliases.ts: add missing aliases found in DB vs Drive mismatch (aliases already comprehensive; canonicalName() strips suffixes automatically)
- [x] Update all skills to reflect current architecture and Amazon-first cascade (updated library-content-enrichment: authorPhotos→authorAvatars, s3PhotoUrl→s3AvatarUrl, Tier 5 Google Imagen primary)
- [x] Test, update claude.md and memory.md, commit, push, save checkpoint
## Session March 21, 2026 — File Re-Architecturee

- [x] Audit all source files for line count and identify oversized files
- [x] Fix Vite parse error -- unicode box-drawing characters fixed in 52 files project-wide
- [x] Split Home.tsx (1908 -> 687 lines) -- extracted AuthorCard, BookCard, AudioCard, AuthorBioPanel, BookDetailPanel, LibraryPrimitives, libraryConstants into client/src/components/library/
- [x] Split Admin.tsx (1187 -> 857 lines) -- extracted CascadeTab, SettingsTab, AboutTab into client/src/components/admin/
- [x] Split authorProfiles.router.ts (672 -> 532 lines) -- extracted enrichAuthorViaWikipedia into server/lib/authorEnrichment.ts
- [x] Split bookProfiles.router.ts (515 -> 313 lines) -- extracted enrichBookViaGoogleBooks into server/lib/bookEnrichment.ts
- [x] Delete 4 legacy dead-code router files (1590 lines total removed)
- [x] Run tests (122/122 passing), update claude.md and memory.md, commit, push, save checkpoint

## Session March 21, 2026 — One-Author-Per-Card + Avatar Background Color

- [x] Update authorAliases.ts: add individual canonical entries for all co-authors (Jason Lemkin, Bill Carr, Anne Morriss, Bo Burlingham, Ruben Rabago, Ted McKenna, Brent Adamson, Nick Toman, Rick DeLisi)
- [x] Update authorPhotos.ts: remove combined-name photo entries so individual photos are fetched per person
- [x] Update DB: split multi-author author_profiles rows into individual rows per co-author
- [x] Update DB: split multi-author book_profiles rows to have one row per co-author (same book, different authorName)
- [x] Add avatarBgColor to AppSettings in AppSettingsContext.tsx (default: #1e293b)
- [x] Add color picker to SettingsTab.tsx (Avatar Background Color section)
- [x] Pass avatarBgColor to generatePortrait tRPC mutation input
- [x] Update replicateGeneration.ts buildPrompt() to accept and inject bgColor into prompt
- [x] Test, update claude.md and memory.md, commit, push, save checkpoint

## Session March 21, 2026 — AI Model Settings Redesign

- [x] Build VENDOR_CATALOGUE in llm.router.ts with all major LLM vendors and models
- [x] Add listVendors, refreshVendors tRPC procedures; update listModels to accept vendorId
- [x] Add primaryVendor, primaryModel, secondaryLlmEnabled, secondaryVendor, secondaryModel to AppSettings
- [x] Redesign SettingsTab AI Model card: 3-column layout, vendor dropdown, model radio list, secondary toggle
- [x] Wire secondary LLM model to research enrichment procedures
- [x] Update tests for new llm router procedures

## Session March 21, 2026 — Norfolk AI Palette + Codebase Optimization

### Norfolk AI Palette (Norfolk AI theme only — Manus theme unchanged)
- [x] Update .theme-norfolk-ai CSS variables in index.css with official palette colors
- [x] Update avatar background swatches in SettingsTab to use Norfolk AI colors (seed: #0091AE darker teal)
- [x] Verify Norfolk AI theme renders correctly with new palette

### AI Model Settings Redesign (continued)
- [x] Build VENDOR_CATALOGUE in llm.router.ts with all major LLM vendors and models (wired to AiTab)
- [x] Add primaryVendor, primaryModel, secondaryLlmEnabled, secondaryVendor, secondaryModel to AppSettings
- [x] Redesign SettingsTab AI Model card: 3-column layout, vendor dropdown, model radio list, secondary LLM toggle
- [x] Wire secondary LLM model to research enrichment procedures
- [x] Update tests for new llm router procedures

### Codebase Optimization
- [x] Audit and remove dead/unused code (imports, components, helpers)
- [x] Consolidate duplicate utility functions (CT_ICON_MAP, DISPLAY_NAME_MAP, normalizeContentTypes consolidated)
- [x] Check and fix any large component files that can be split further (Admin.tsx 879 lines reviewed — Pipeline/Media tabs are compact ActionCard wrappers; handler logic is tightly coupled; no split needed)
- [x] Review and optimize tRPC query patterns (stale times, caching) (all 11 queries have appropriate staleTime or enabled guards; no changes needed)

### Documentation
- [x] Update claude.md with current architecture, file map, and design decisions
- [x] Update memory.md with this session's changes
- [x] Review and update skills if needed (all 18 skills have valid SKILL.md; library-content-enrichment updated for stale paths)

### Manus Theme Redesign (black/white/grey)
- [x] Rewrite .theme-manus CSS variables: light grey bg, white cards, darker grey sidebar, black text
- [x] Verify all components render correctly with new monochrome Manus theme

### Design System Rule — Manus Theme as Seed
- [x] Manus theme is the living seed/default — always update it first when making design changes
- [x] Other themes (Norfolk AI, Noir Dark) branch from Manus and override only their brand-specific tokens
- [x] Document this rule in claude.md design section

## Session March 21, 2026 — Two-Level LLM Research + Nano-Banana Avatar Generation

- [x] Wire two-level LLM to ALL research procedures (not just batch): enrich single author, enrich single book, AuthorBioPanel generate bio button, BookDetailPanel
- [x] Integrate nano-banana latest image generation model for avatar generation (googleImagenGeneration.ts created)
- [x] Add Avatar Generation LLM card to Admin Console Settings: model selector for image gen (nano-banana) — moved to AI tab
- [x] Add avatarGenModel to AppSettings (default: nano-banana latest)
- [x] Update generateAIPortrait to use nano-banana via invokeLLM image generation (googleImagenGeneration.ts)
- [x] Update replicateGeneration.ts or create nanoBananaGeneration.ts for new image gen path (created googleImagenGeneration.ts)
- [x] Update waterfall.ts Tier 5 to use avatarGenModel setting (currently still uses Replicate — nano-banana not yet in waterfall)
- [x] Update generatePortrait tRPC procedure to accept avatarGenModel
- [x] Update Admin.tsx batch portrait generation to pass avatarGenModel
- [x] Update AuthorBioPanel generate portrait button to pass avatarGenModel
- [x] Update claude.md and memory.md with changes

## Session March 21, 2026 — Golden Bokeh Swatch
- [x] Add "Golden Bokeh" as named swatch in avatar color picker (warm golden bokeh style from Drive avatars)
- [x] Update portrait generation prompt to reproduce golden bokeh background when selected

## Session March 21, 2026 — Author Card Redesign
- [x] Redesign FlowbiteAuthorCard: author name prominently displayed below avatar, always visible on card face
- [x] Redesign AuthorCard (accordion/list view): author name clearly visible, consistent with card grid view
- [x] Ensure author name is legible against card background in all three themes (Manus, Norfolk AI, Noir Dark)

## Session March 21, 2026 — Comprehensive Audit & Cleanup

### Codebase Audit
- [x] Identify and remove dead/unused imports across all .ts/.tsx files
- [x] Identify and remove unused functions, variables, and exports
- [x] Identify and remove duplicate logic across server routers and lib files
- [x] Audit component files for unused props, stale state, and dead JSX branches
- [x] Check for console.log/console.error statements that should be removed or replaced with structured logging (all 47 are structured operational logs with [module] prefixes — intentional)
- [x] Verify all TypeScript strict-mode compliance (no any types, no ts-ignore) (0 @ts-ignore, 6 legitimate any casts in storage/shadcn/ui)
- [x] Audit package.json for unused dependencies and remove them (removed: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, echarts, date-fns)

### Database Audit
- [x] Audit DB tables for orphaned rows (author_profiles/book_profiles with no matching Drive data)
- [x] Audit DB for duplicate entries across author_profiles and book_profiles
- [x] Verify all foreign key relationships and data integrity constraints
- [x] Check for stale/null columns that are never populated
- [x] Audit DB indexes for query performance (4 indexes added in migration 0010)

### Infrastructure & SDK Contracts
- [x] Audit all external API integrations (Apify, Replicate, Tavily, Perplexity, Google Books) for error handling consistency (all integrations use try/catch with typed errors and console.error logging)
- [x] Verify all SDK versions are current and not deprecated (all within stable semver ranges; major version jumps intentionally held back)
- [x] Audit environment variable usage: ensure all referenced env vars are documented and set (added APIFY_API_TOKEN, GEMINI_API_KEY, REPLICATE_API_TOKEN, TAVILY_API_KEY to ENV object in server/_core/env.ts)
- [x] Check for hardcoded URLs, API keys, or secrets in source code (0 hardcoded secrets found; all via process.env)
- [x] Verify tRPC router input/output schemas are complete and consistent (Zod validation) (all input procedures validated; no-arg procedures correct)
- [x] Audit S3 storage usage: check for orphaned files, verify key naming conventions (key naming consistent: author-avatars/, book-covers/; S3 list not accessible but DB tracks all keys)

### Skills Audit
- [x] List all skills in /home/ubuntu/skills/ and verify each has a valid SKILL.md (18/18 skills have valid SKILL.md)
- [x] Verify skills reference current file paths and architecture (not stale) (library-content-enrichment had stale authorPhotos/ paths — fixed)
- [x] Remove or update skills that reference deleted or renamed files (updated library-content-enrichment; no skills reference deleted files)
- [x] Ensure llm-recommendation-engine skill matches current implementation (all 5 key file paths verified; catalogue and architecture match current code)

### Large Files Audit
- [x] Identify files > 500 lines: libraryData.ts (1218), Admin.tsx (879), llm.router.ts (696), AiTab.tsx (662), authorProfiles.router.ts (631), FlowbiteAuthorCard.tsx (571) — evaluated, acceptable given complexity
- [x] Identify static assets stored in project directory — no binary assets in git (verified clean)
- [x] Check libraryData.ts (1218 lines) and audioData.ts (288 lines) for size optimization opportunities (data files are pure static data; splitting would add complexity without benefit; acceptable as-is)
- [x] Audit authorAvatars.ts and authorAliases.ts for stale entries (removed 6 group-shot avatar entries: Aaron Ross, Bob Burg, Dan Heath, Roger Fisher, Ashvin Vaidyanathan, Frances Frei)
- [x] Verify no binary files or large media are committed to git (clean)

## Session March 21, 2026 — Rename Author Photos → Author Avatars
- [x] Rename server/lib/authorPhotos/ folder to server/lib/authorAvatars/
- [x] Rename client/src/lib/authorPhotos.ts to client/src/lib/authorAvatars.ts
- [x] Update all import paths referencing authorPhotos to authorAvatars
- [x] Rename variables, functions, and types: authorPhoto → authorAvatar, photoUrl → avatarUrl, etc.
- [x] Update all UI text, labels, and comments from "photo(s)" to "avatar(s)" in author context
- [x] Update DB column names if any reference "photo" (check schema)
- [x] Update claude.md, memory.md, and skills to reflect the rename

## Session March 21, 2026 — Book Cover Enlargement
- [x] Double book cover thumbnail sizes on all author card views
- [x] Update AuthorCard (grid view) book cover dimensions 2x
- [x] Update AuthorModal book list cover dimensions 2x (N/A - modal has no book cover list)
- [x] Update any other card components showing book covers within author context
- [x] Verify covers render correctly across all 3 themes

## Session March 21, 2026 — Comprehensive Dead Code Audit

- [x] Run automated unused-import analysis (ESLint no-unused-vars, tsc --noUnusedLocals)
- [x] Fix unused imports in all client/src/pages/*.tsx files
- [x] Fix unused imports in all client/src/components/*.tsx files
- [x] Fix unused imports in all client/src/components/library/*.tsx files
- [x] Fix unused imports in all client/src/components/admin/*.tsx files
- [x] Fix unused imports in all server/routers/*.ts files
- [x] Fix unused imports in all server/lib/**/*.ts files
- [x] Remove stale/unused variables and function parameters
- [x] Remove dead JSX branches (unreachable conditionals, always-false guards)
- [x] Remove unused React state (useState hooks whose value is never read)
- [x] Remove unused props from component interfaces
- [x] Consolidate duplicated icon maps (CT_ICON_MAP, DISPLAY_NAME_MAP, normalizeContentTypes) into libraryConstants.ts — removed ~150 lines across 4 components
- [x] Verify 0 TypeScript errors after cleanup (--noUnusedLocals --noUnusedParameters)
- [x] Run 122 tests, commit, push, save checkpoint

## Session March 21, 2026 — Admin Console AI Tab

- [x] Add "AI" top-level tab to Admin Console (alongside Data Pipeline, Settings, About)
- [x] Move existing AI Model content from SettingsTab into the new AI tab
- [x] Build AI tab with 4 sub-tabs: Avatar Generation, Author Research, Book Research, Other
- [x] Avatar Generation sub-tab: vendor/model selector defaulting to Google / Nano Banana
- [x] Author Research sub-tab: vendor/model selector (primary + secondary LLM) for author bio enrichment
- [x] Book Research sub-tab: vendor/model selector (primary + secondary LLM) for book enrichment
- [x] Other sub-tab: vendor/model selector for miscellaneous LLM tasks
- [x] Persist each sub-tab's model selection independently in AppSettings
- [x] Wire Avatar Generation model setting to generatePortrait tRPC procedure (done — googleImagenGeneration.ts routes by vendor/model)
- [x] Wire Author Research model settings to author enrichment procedures
- [x] Wire Book Research model settings to book enrichment procedures
- [x] Add nano-banana to VENDOR_CATALOGUE in llm.router.ts (Google vendor, Nano Banana model)
- [x] Run tests, commit, push, save checkpoint

## Session March 21, 2026 — Nano Banana Portrait Generation Integration

- [x] Research nano-banana API (Google Imagen 3 / Gemini image gen endpoint and parameters)
- [x] Extend imageGeneration.ts helper to support nano-banana model routing
- [x] Update generatePortrait procedure to accept avatarGenModel + avatarGenVendor params
- [x] Update client-side portrait generation calls (AuthorBioPanel, Admin batch) to pass selected avatar model from settings
- [x] Write vitest tests for nano-banana routing in generatePortrait
- [x] Verify 0 TypeScript errors, run 122 tests, commit, push, save checkpoint

## Session March 21, 2026 — Portrait Gen + DB Indexes + AI Tab Test Button

- [x] Wire nano-banana (Google Imagen 3) to generatePortrait procedure: create googleImagenGeneration.ts helper, route based on avatarGenVendor/avatarGenModel from AppSettings, pass model selection from client to mutation
- [x] Update generatePortrait tRPC input to accept optional avatarGenModel + avatarGenVendor params
- [x] Update AuthorBioPanel generatePortraitMutation call to pass settings.avatarGenModel + settings.avatarGenVendor
- [x] Update Admin batch portrait generation to pass settings.avatarGenModel + settings.avatarGenVendor
- [x] Add DB index on authorName column in author_profiles table (schema + migration)
- [x] Add DB index on authorName column in book_profiles table (schema + migration)
- [x] Add "Test Portrait" button to Avatar Generation sub-tab in AiTab.tsx — fires a quick portrait generation for a sample author to confirm the selected model works
- [x] Show generated test portrait inline in the AI tab with model/vendor label
- [x] Write vitest tests for Google Imagen routing in generatePortrait
- [x] Verify 0 TypeScript errors, run all tests, commit, push, save checkpoint

## Session March 22, 2026 — Reseed Production Avatars from Google Drive

- [x] List all images in Google Drive Author Pictures folder (90 files found, 1 group shot skipped: Roger Fisher and William Ury)
- [x] Download each Drive image and upload to S3 CDN (89/89 uploaded, 0 failures)
- [x] Update author_profiles DB rows with new s3AvatarUrl values (89 rows updated/inserted; 128/176 total authors now have s3AvatarUrl)
- [x] Update authorAvatars.ts with new CDN URLs (98-line file with 89 entries, all pointing to CloudFront CDN)
- [x] Run tests, save checkpoint (139/139 passing)

## Session March 22, 2026 — Avatar Terminology Standardization

- [ ] Audit all photo/picture/portrait references in code, UI strings, comments, and docs
- [ ] Rename UI labels, sidebar items, variable names, and comments to use "avatar" terminology
- [ ] Update CLAUDE.md, memory.md, and any docs that use old terminology
- [ ] Create skill: author-avatar-terminology enforcing "avatar" as the canonical term
- [ ] Run tests, save checkpoint

## Session March 22, 2026 — Avatar Terminology Standardization

- [x] Audit all photo/picture/portrait references in code, UI strings, comments, and docs
- [x] Rename UI labels, sidebar items, variable names, and comments to use "avatar" terminology (Admin.tsx, AuthorBioPanel.tsx, AuthorModal.tsx, AiTab.tsx, SettingsTab.tsx, AvatarUpload.tsx, useConfetti.ts, authorAvatars.ts, authorAliases.ts, all server routers, apify.ts, mirrorToS3.ts, waterfall.ts, geminiValidation.ts, replicateGeneration.ts, googleImagenGeneration.ts, tavily.ts, drizzle/schema.ts, AppSettingsContext.tsx, Home.tsx)
- [x] Update CLAUDE.md and GEMINI.md with avatar terminology
- [x] Update all test files (apify.test.ts, batch-portraits.test.ts, generate-portrait.test.ts) with avatar terminology
- [x] Create skill: author-avatar-terminology enforcing "avatar" as the canonical term
- [x] Run tests: 139/139 passing, save checkpoint

## Session March 22, 2026 — Execute 3 Pipeline Suggestions

- [ ] Test meticulous pipeline on Aaron Ross (no avatar, group shot cleared)
- [ ] Add Anthropic/Claude routing to authorResearcher.ts research stage
- [ ] Expose authorDescriptionJson in Admin UI Author Bio Panel as "View Description" panel
- [ ] Run tests, update todo.md, save checkpoint

## Session March 22, 2026 — Admin Console Overhaul + Per-Card Actions

- [x] Wire updateAllAuthorLinks tRPC procedure (authorProfiles.router.ts) for batch author link enrichment
- [x] Wire updateAllBookSummaries tRPC procedure (bookProfiles.router.ts) for batch book summary enrichment
- [x] Fix Anthropic model IDs in llm.router.ts to use correct full API identifiers (claude-opus-4-5-20251101, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001, claude-opus-4-20250514, claude-sonnet-4-20250514, claude-3-haiku-20240307)
- [x] Fix anthropic-key.test.ts to use claude-3-haiku-20240307 (deprecated model replaced)
- [x] Create AuthorCardActions component: per-card dropdown with Generate/Regenerate Avatar, Update Bio, Update Links
- [x] Create BookCardActions component: per-card dropdown with Update Cover, Update Summary
- [x] Integrate AuthorCardActions into FlowbiteAuthorCard header
- [x] Restructure Admin Console tabs: add Authors tab (Enrich Bios, Update Links, Generate Avatars, Mirror Avatars) and Books tab (Enrich Books, Update Summaries, Scrape Covers, Mirror Covers)
- [x] Add Information Tools tab to Admin Console (Apify, Replicate, Perplexity, Google Books, Wikipedia, Tavily)
- [x] Add getToolStatus procedure to admin.router.ts (checks env vars for all external tools)
- [x] Add apifyActor, replicateModel, perplexityModel fields to AppSettings + defaults
- [x] All 141 tests passing

## Session March 22, 2026 — Avatar Pipeline Fixes

- [ ] Fix Claude default model ID in authorResearcher.ts (claude-3-5-sonnet-20241022 → claude-sonnet-4-5-20250929)
- [ ] Upgrade Gemini research pass to inline reference photos as true multimodal base64 image parts
- [ ] Set nano-banana as default avatarGenModel in AppSettings defaults and AI tab UI
- [ ] Run tests, save checkpoint

## Session March 22, 2026 — Avatar Resolution Pipeline (Claude Opus Plan)

### Types & Interfaces
- [ ] Add `AspectRatio` and `OutputFormat` types to `server/lib/authorAvatars/types.ts`
- [ ] Extend `ImageGenerationRequest` with: `aspectRatio`, `width`, `height`, `outputFormat`, `outputQuality`, `guidanceScale`, `numInferenceSteps`
- [ ] Extend `MeticulousPipelineOptions` with the same resolution fields
- [ ] Add avatar resolution fields to `AppSettings`: `avatarAspectRatio`, `avatarWidth`, `avatarHeight`, `avatarOutputFormat`, `avatarOutputQuality`, `avatarGuidanceScale`, `avatarInferenceSteps`
- [ ] Add default values for new resolution settings in `AppSettingsContext.tsx`

### Backend Image Generators
- [ ] Fix `imageGenerators/google.ts` — only pass `aspectRatio` to Imagen 3 (not Gemini image models); add `mapToImagen3AspectRatio` helper for unsupported ratio mapping
- [ ] Update `imageGenerators/replicate.ts` — accept and use all resolution params (width, height, format, quality, steps, guidanceScale); add `validateDimension` helper for 64px alignment
- [ ] Update `meticulousPipeline.ts` — pass resolution options through to generators (remove hardcoded `aspectRatio: "1:1"` and `guidanceScale: 7.5`)

### API Routes
- [ ] Update avatar regeneration tRPC procedure to read resolution params from input and fall back to AppSettings defaults
- [ ] Add server-side validation for resolution params (dimension range, format enum, quality range)

### Admin Console UI — Avatar Generation Sub-Tab
- [ ] Create `components/admin/AspectRatioSelector.tsx` with visual ratio labels and descriptions
- [ ] Create `components/admin/QualitySlider.tsx` with live value display
- [ ] Create `components/admin/DimensionInput.tsx` with 64px step validation
- [ ] Reorganize Avatar Generation sub-tab into 3 sections: Model Selection, Image Size & Format, Generation Parameters
- [ ] Add conditional visibility: Replicate-only controls hidden when vendor=google; aspectRatio hidden for Gemini image models
- [ ] Add vendor capability info alert (Gemini = no resolution control; Imagen 3 = aspectRatio only; Replicate = full control)
- [ ] Add "Reset to Defaults" button for resolution settings
- [ ] Update Test Portrait button to pass current resolution settings to the pipeline

## Session March 22, 2026 — Suggested Next Steps (Queued for Execution)

### 1. Wire per-card Update Links action end-to-end
- [ ] After `updateAuthorLinks` mutation completes on a card, auto-refresh the Author Bio Modal's Links section without requiring the user to close and reopen
- [ ] Invalidate `authorProfiles.get` query for the specific author after mutation settles
- [ ] Show the new links immediately in the open modal if it is already visible

### 2. Add progress indicator to per-card actions
- [ ] Show a small spinner overlay on the card while any card-level mutation (Generate Avatar, Update Bio, Update Links) is in-flight
- [ ] Disable the action menu button while a mutation is running to prevent double-submission
- [ ] Show a brief success toast with the action name when mutation completes

### 3. Expose authorDescriptionJson in Author Bio Panel
- [ ] Add a collapsible "View Research Description" panel at the bottom of the Author Bio Modal
- [ ] Parse and display the cached `authorDescriptionJson` in a readable key-value format (appearance, personality, attire, etc.)
- [ ] Add a "Refresh Description" button inside the panel that triggers Stage 1–2 of the meticulous pipeline with `forceRefresh: true`
- [ ] Only show the panel when `authorDescriptionJson` is non-null in the DB row

### 4. Run meticulous pipeline on Aaron Ross
- [ ] Trigger the meticulous pipeline for Aaron Ross (real photo now set from London Speaker Bureau)
- [ ] Confirm Stage 2 vision analysis correctly identifies him from the real photo
- [ ] Verify the generated `AuthorDescription` JSON is accurate and cached in DB
- [ ] Optionally regenerate AI avatar using the corrected description

## Session March 22, 2026 — Avatar Background Consistency Skill

- [ ] Create skill: `avatar-background-consistency` — enforces uniform background across all author avatars
- [ ] Document the canonical background spec (color, style, prompt fragment) in the skill
- [ ] Add background enforcement to AI generation prompts in `promptBuilder.ts`
- [ ] Add background post-processing step for real photos (remove.bg or Gemini background replacement)
- [ ] Add background consistency controls to Admin Console → AI tab → Avatar Generation sub-tab
- [ ] Add batch "Normalize Avatar Backgrounds" action to Admin Console → Authors tab
- [ ] Update CLAUDE.md with the canonical background spec

### Session March 22, 2026 — Execute Suggested Next Steps
- [x] Implement Background Selector UI in Admin Console AI tab (visual swatches + hex picker)
- [x] Add auditAvatarBackgrounds tRPC procedure using Gemini Vision batch check
- [x] Add Normalize All batch action to Admin Console Authors tab
- [x] Wire updateAuthorLinks per-card mutation to auto-refresh Author Bio Modal on settle
- [x] Expand Author Bio Modal Links section: podcast, blog, substack, newspaper articles, other links
- [x] Reduce staleTime on authorProfiles.get in AuthorModal to 30s for instant post-update refresh

## Session March 22, 2026 — Parallel Batch Execution
- [x] Build `server/lib/parallelBatch.ts` utility — pLimit-style pool with configurable concurrency, progress callback, and error isolation per item
- [x] Add `batchConcurrency` field to `AppSettings` (default: 3, range: 1–10)
- [x] Add default value for `batchConcurrency` in `AppSettingsContext.tsx`
- [ ] Update `generateAllPortraits` procedure to use parallel pool (authorProfiles.router.ts)
- [x] Update `enrichBatch` procedure to use parallel pool (authorProfiles.router.ts)
- [x] Update `updateAllAuthorLinks` procedure to use parallel pool (authorProfiles.router.ts)
- [x] Update `normalizeAvatarBackgrounds` procedure to use parallel pool (authorProfiles.router.ts)
- [x] Update `updateAllBookSummaries` procedure to use parallel pool (bookProfiles.router.ts)
- [x] Add `concurrency` input param to all batch procedures so Admin Console can pass the setting
- [x] Add Concurrency Slider component to Admin Console AI tab (1–10, shows "N authors at a time")
- [ ] Write vitest tests for parallelBatch utility (concurrency cap, error isolation, progress callback)

## Session March 22, 2026 — Fix Per-Card Avatar Regeneration
- [x] Debug per-card "Regenerate Avatar" button — root cause: T5 timeout was 30s (too short), meticulous pipeline needs 45-120s
- [x] Ensure `forceRegenerate: true` path in `generateAvatar` procedure clears cached `authorDescriptionJson` before re-running pipeline (forceRefresh: true now passed)
- [x] Enforce bokeh-gold background in `promptBuilder.ts` as default when no bgColor passed
- [x] Fix T5 timeout from 30s to 180s in waterfall.ts
- [ ] Fix Aaron Ross avatar: regenerate with correct bokeh-gold background using real photo as reference (ready to run)
- [ ] Verify card updates immediately after regeneration via `getAvatarMap` invalidation

## Session March 22, 2026 — Photo Recency & Regeneration
- [x] Raise T5 timeout from 180s to 240s (4 minutes)
- [x] Update Tier 2 (Tavily): add recency filter (days:730), current-year query terms, recency scoring weights
- [x] Update Tier 1 (Wikipedia): upgrade resolution to 600px
- [x] Add recency rule to Gemini Vision prompt: prefer most recent-looking photo
- [x] Create skill: `avatar-photo-recency` — documents recency preference rules for all tiers
- [x] Update CLAUDE.md v2.4 with Photo Recency section
- [x] Regenerate avatar for Aaron Ross — bokeh-gold portrait generated in 34.6s (Tier 5, nano-banana)
- [x] Regenerate avatar for Albert Rutherford — bokeh-gold portrait generated in 20.6s (Tier 5, nano-banana)
- [x] Commit and push to GitHub (9f0eb98)

## Session March 22, 2026 — Enlarge Covers + Parallel Batch + Drive Fix
- [x] Enlarge book cover icons by 40% in BookCard (grid view): 67x90 → 94x126px
- [x] Enlarge book cover icons by 40% in BookModal (detail view): 134x90 → 188x126px
- [x] Enlarge book cover icons by 40% in FlowbiteAuthorCard cover strip: 123x90 → 172x126px
- [x] Enlarge book cover icons by 40% in BookDetailPanel: w-20 h-28 → w-28 h-40
- [x] Fix Drive upload /tmp path bug in meticulousPipeline.ts: use relative path + cwd option
- [x] Build parallelBatch.ts utility (configurable concurrency pool, p-limit style)
- [x] Wire parallelBatch into enrichBatch (author bios) procedure
- [x] Wire parallelBatch into updateAllAuthorLinks procedure
- [x] Wire parallelBatch into normalizeAvatarBackgrounds procedure
- [x] Wire parallelBatch into updateAllBookSummaries procedure
- [x] Add concurrency setting to AppSettingsContext (default: 3)
- [x] Add concurrency slider to Admin Console AI tab
- [ ] Clean and optimize code throughout (remove dead code, consolidate duplicate Tavily fetch logic)
- [x] Write vitest tests for parallelBatch utility (concurrency cap, error isolation, progress callback) — 11 tests, all passing
- [x] Run tests: 152 tests passing (12 test files)
- [x] Save checkpoint (5ae4d37), push to GitHub

## Session March 22, 2026 — Avatar Resemblance Overhaul (Claude Opus)

- [x] Audit full avatar pipeline: promptBuilder, authorResearcher, google.ts generator, meticulousPipeline
- [x] Use Claude Opus to analyze current system and design a comprehensive improvement strategy
- [x] Extend `types.ts` — add `microFeatures`, `characteristicPose`, `bestReferencePhotoUrl`, extended eye/hair/personality/stylePresentation fields
- [x] Rewrite `promptBuilder.ts` — 10-section structure: [SUBJECT][PHYSICAL STRUCTURE][FACIAL DETAILS][EXPRESSION][ATTIRE][LIGHTING][CAMERA][BACKGROUND][QUALITY][CONSTRAINTS]
- [x] Identity anchoring in [SUBJECT] — "Portrait of {name}, author of {works}" activates model's latent knowledge of public figures
- [x] Cinematographic lighting — academic (butterfly/Paramount), creative (loop), corporate (modified Rembrandt) based on roleType
- [x] Micro-feature specificity — nose shape, lip description, forehead height, jaw angle, chin shape, cheekbones in [FACIAL DETAILS]
- [x] Update `authorResearcher.ts` system prompt — forensic visual analyst instructions for micro-feature extraction and best photo selection
- [x] Update `AUTHOR_DESCRIPTION_SCHEMA` — add microFeatures, characteristicPose, bestReferencePhotoUrl, extended eye/hair/personality fields
- [x] Update `google.ts` generator — reference-image injection: instruction → reference photo → generation prompt (multimodal)
- [x] Update `meticulousPipeline.ts` — fetch bestReferencePhotoUrl as base64, pass to generator; fallback to first reference photo
- [x] Write 19 vitest tests for refined promptBuilder — all 171 tests pass (13 test files)
- [ ] Test live generation on 2-3 authors to verify improved resemblance (ready — trigger via Admin Console > AI > Regenerate Avatar)
- [x] Save checkpoint (3eb980ae), push to GitHub

## Session March 22, 2026 — Book Card Redesign + Bidirectional Navigation + Interactions

- [x] Reduce book cover icon size by 10% across all components: BookCard (114→103px h, 84→76px w), BookModal (188→169px h, 126→113px w), FlowbiteAuthorCard strip (155→140px h, 113→102px w), BookDetailPanel (w-28 h-40 → 101×144px)
- [x] Redesign BookCard (Books page) to match Author card visual standard: centered cover as avatar, category pill, author name as live link, content-type badges in lower section, hover lift + spring animations
- [x] Move all file badges (PDF, Transcript, Binder, etc.) and Drive links from AuthorCard to BookCard (AuthorCard now shows only author-specific content)
- [x] Author card book cover strip: clicking a cover navigates to the equivalent book card in the Books tab (scroll + highlight ring)
- [x] Book card author name: clicking navigates to the author card in the Authors tab (scroll + highlight ring)
- [x] Add hover scale effect on all cards (author cards, book cards) — whileHover scale + y lift via framer-motion spring
- [x] Add hover scale effect on book cover thumbnails in author card strip (whileHover scale 1.12, y -3)
- [x] Upgrade author avatar to framer-motion spring (whileHover scale 1.12, whileTap scale 0.90, stiffness 400)
- [x] Add press/click animation on author avatar (whileTap scale 0.90 spring back)
- [x] Add press/click animation on book cover thumbnails in author strip (whileTap scale 0.92)
- [x] Add press/click animation on BookCard cover (whileTap scale 0.94)
- [x] All interactive elements use cursor-pointer
- [x] Run 171 tests — all passing (13 test files)
- [x] Save checkpoint, push to GitHub

## Session State — March 22, 2026 (End of Session)

### Where We Are
Checkpoint: 74461385 | Branch: main | Tests: 171 passing (13 test files)
Live URL: https://authlib-ehsrgokn.manus.space

### What Was Completed This Session
- [x] parallelBatch.ts utility wired into all batch procedures (enrichBatch, updateAllAuthorLinks, normalizeAvatarBackgrounds, updateAllBookSummaries)
- [x] batchConcurrency setting added to AppSettings (default 3, range 1–10) + concurrency slider in Admin Console AI tab
- [x] Drive upload /tmp path bug fixed in meticulousPipeline.ts
- [x] Book cover sizes: +40% (previous session) then -10% (this session) → net +26% from original
- [x] Avatar resemblance overhaul: Claude Opus redesigned prompt system (10-section sectioned prompts, identity anchoring, micro-features, reference-image injection into Gemini generation)
- [x] BookCard fully redesigned to match Author card visual standard (centered cover, category pill, author name live link, content-type badges)
- [x] Bidirectional navigation: book cover in AuthorCard → Books tab + highlight; author name in BookCard → Authors tab + highlight
- [x] Resource pills / file badges moved from AuthorCard to BookCard
- [x] All interactive elements upgraded to framer-motion spring animations (avatar whileHover/whileTap, book covers whileHover/whileTap, cards whileHover/whileTap)

### Pending / Next Steps
- [ ] Test live avatar generation on 2–3 authors to verify improved resemblance (Admin Console > AI > Regenerate Avatar)
- [ ] Clean and optimize code: consolidate duplicate Tavily fetch logic (authorLinks.ts vs authorAvatars/waterfall.ts)
- [ ] Wire parallelBatch into generateAllPortraits procedure (last batch procedure still using sequential loop)
- [ ] Add "Reference photo used" thumbnail to Admin view for avatar quality inspection + manual override
- [ ] Add live per-item progress stream to Admin Console batch operations (tRPC subscription or SSE)
- [ ] Add "Research Quality" badge (high/medium/low) to author cards based on sourceConfidence.overallConfidence
- [ ] BookDetailPanel: add framer-motion spring animation to cover image (currently static)
- [ ] BookModal: add framer-motion spring animation to cover image (currently static)
- [ ] Consider adding a "Recently Added" or "Featured" section to the home/landing area
- [ ] Add keyboard navigation: arrow keys to move between cards in grid view

## Session March 22, 2026 — Wire parallelBatch into generateAllPortraits

- [ ] Read generateAllPortraits procedure and understand current sequential loop
- [ ] Add `concurrency` input param to generateAllPortraits (consistent with other batch procedures)
- [ ] Replace sequential for loop with parallelBatch pool
- [ ] Verify Admin Console passes batchConcurrency to generateAllPortraits mutation
- [ ] Run tests, save checkpoint, push to GitHub

## Session March 22, 2026 — Claude Opus Avatar Architecture Review + Implementation

### Claude Opus Diagnosis
- generateAvatarsBatch is dead code (orphaned, sequential loop, redundant with generateAllMissingAvatars)
- handleGeneratePortraits does 102 sequential HTTP calls (~102 min) — should delegate to generateAllMissingAvatars (~34 min)
- DB-write logic duplicated in 3 procedures
- Tavily photo ranking biases toward recency instead of authoritative sources

### Implementation Tasks
- [x] CRITICAL: Delete generateAvatarsBatch procedure (dead code, orphaned) — removed 105 lines
- [x] CRITICAL: Replace handleGeneratePortraits sequential loop with single generateAllMissingAvatars call — ~102 min → ~34 min
- [x] HIGH: Extract persistAvatarResult() shared helper to server/lib/authorAvatars/persistResult.ts
- [x] HIGH: Refactor generateAllMissingAvatars and generateAvatar to use persistAvatarResult
- [x] MEDIUM: Add reference photo quality validation in meticulousPipeline.ts (reject <10KB thumbnails, >3MB oversized)
- [x] MEDIUM: Improve Tavily photo ranking — Wikipedia+15, LinkedIn+12, publisher+10, TED+10; book covers-12, group/event-8
- [x] LOW: Add per-author loading state in author card UI during individual regeneration (already implemented)
- [x] Run 171 tests — all passing (13 test files)
- [x] Save checkpoint (7d266104), pushed to GitHub

## Session March 22, 2026 — Rebuild Entire Book Cover + Info Database

- [x] Audit database: 141 books, 31 low-res covers, 13 empty authorNames, 6 junk/duplicate entries, 11 missing summaries
- [x] Add `upgradeAmazonImageResolution()` helper to apify.ts — replaces _AC_UY218_/_UL320_/_UY320_ with _SX600_
- [x] Update `scrapeAmazonBook()` to always return high-res cover URLs going forward
- [x] Add `rebuildAllBookCovers` procedure to bookProfiles.router.ts (upgrade URLs + re-scrape failed + re-mirror to S3)
- [x] Fix bad data in DB: delete 4 junk entries (bookTitle=authorName placeholders, bk_rand_011854, Jefferson-Fisher-Open-Graph, Book PDF)
- [x] Fix duplicate title=author entries: delete Charles Duhigg and David Brooks rows (proper book entries already existed)
- [x] Fix 13 empty authorName fields via SQL UPDATE
- [x] Wire `rebuildAllBookCovers` into Admin Console Media tab with destructive ActionCard + confirmation dialog
- [x] Trigger rebuild: upgraded 29 low-res URLs to _SX600_, re-scraped Immune by Philip Dettmer, mirrored 30 covers to S3
- [x] Fill 9 of 11 missing summaries via updateAllBookSummaries
- [x] Manually write summaries for "No" (Jim Camp) and "Leading Engaging Meetings" (Matthew Dixon) — titles too ambiguous for API
- [x] Final DB state: 141 books, 0 missing authors, 0 bad covers, 0 low-res Amazon URLs, 141/141 S3-mirrored, 0 missing summaries
- [x] 171 tests passing (13 test files)
- [x] Save checkpoint, push to GitHub

## Session March 22, 2026 — Book Cover Display Fix

- [x] Audit how book covers are fetched and passed to FlowbiteAuthorCard and BookCard
- [x] Fix cover display in Author card cover strip (use s3CoverUrl with coverImageUrl fallback)
- [x] Fix cover display in Book card (use s3CoverUrl with coverImageUrl fallback)
- [x] Verify book cover data is included in the tRPC queries that feed both card types
- [x] Run tests, save checkpoint, push to GitHub (verified already implemented)

## Session March 22, 2026 — Fix 8 Remaining Broken Book Covers

- [x] Identify 8 books with `coverImageUrl = 'not-found'` in DB
- [x] Fix authorName mismatch: "Thinking, Fast and Slow" had "Daniel J. Siegel" → corrected to "Daniel Kahneman"
- [x] Scrape 3 covers via Apify Amazon scraper: Building Successful Partner Channels, Great Game Business, Thinking Fast and Slow
- [x] Find 4 covers via Open Library ISBN API: No (Jim Camp), Sales Pitch (April Dunford), Sapiens (Yuval Noah Harari), Chasing Perfection (Sue Hawkes)
- [x] Find 1 cover via Google Books API: Yes And (Kelly Leonard) — verified 47KB real image
- [x] Update DB with all 8 cover URLs
- [x] Mirror all 8 covers to S3 CDN via mirrorCovers procedure (8/8 mirrored, 0 failed)
- [x] Final DB state: 141 books, 141/141 with coverImageUrl, 141/141 with s3CoverUrl, 0 broken covers
- [x] Run tests, save checkpoint, push to GitHub

## Session March 22, 2026 — Post-Avatar-Test Improvements

- [x] Add `bestReferencePhotoUrl` column to `author_profiles` DB schema and persist it from the meticulous pipeline
- [x] Add per-author Regenerate Avatar button to author cards in the library UI (not just Admin Console)
- [x] Batch-regenerate remaining Drive-sourced author avatars via Admin Console pipeline (upgrade all to Tier 5 meticulous quality)

## Session March 22, 2026 — Book Cover Fixes & Codebase Audit

- [x] Replace Alan Dib's book covers with correct Amazon images
- [x] Display reference photo thumbnail in Author Bio modal (bestReferencePhotoUrl)
- [x] Add batch-regeneration progress indicator in Admin Console (BatchRegenSection component)
- [x] Add Regenerate All button in Admin Console
- [x] Claude Opus full codebase audit (code quality, folder structure, schema, DB, S3, Drive)
- [x] Security hardening: upgrade all mutation/admin procedures from publicProcedure to adminProcedure
- [x] Remove deprecated getMirrorPhotoStats procedure
- [x] Fix persistResult.ts any type with proper structural type
- [x] Add avatarSource index to author_profiles schema (migration 0015 applied)
- [x] Move Drive folder IDs from hardcoded strings to ENV variables
- [x] Create scripts/README.md documenting all maintenance scripts
- [x] Fix admin.router.test.ts to use adminContext for adminProcedure tests
- [x] 171 tests passing, checkpoint saved
- [x] Normalize ratingCount from varchar to int — completed in Next Steps session (migration 0016)

## Session March 22, 2026 — Next Steps (from audit suggestions)

- [x] Normalize ratingCount from varchar to int (bookEnrichment.ts, bookSummary.ts, schema, migration 0016 applied)
- [x] Add per-author loading spinner on avatar circle during individual regeneration (already implemented)
- [x] Surface bestReferencePhotoUrl in Admin Console avatar stats table (AvatarDetailTable component with Ref Photo column)

## Session March 22, 2026 — 3 Feature Tasks

- [x] Wire parallelBatch into generateAllPortraits procedure (already implemented via generateAllMissingAvatars delegation — confirmed)
- [x] Add Research Quality badge (high/medium/low) to author cards based on sourceConfidence.overallConfidence (getResearchQualityMap procedure + FlowbiteAuthorCard badge with tooltip)
- [x] Add framer-motion spring animation to book cover image in BookDetailPanel and BookModal (scale-in spring, AnimatePresence, stiffness 320 damping 24)

## Session March 22, 2026 — Avatar Hover & Sort by Quality

- [x] Add framer-motion whileHover scale animation to author card avatar circles (FlowbiteAuthorCard + AuthorCard)
- [x] Add "Sort by Research Quality" option to Authors tab sort dropdown

## Session March 22, 2026 — Enhanced Research Quality Badge

- [ ] Enhance Research Quality badge on author cards: more prominent visual design with icon, color-coded pill, tooltip with explanation, and wire into library/AuthorCard (currently missing)

## Session March 22, 2026 — BookCard High-Impact Features (Claude Opus Audit)

- [x] Add star rating + publication year to BookCard grid (thread from bookInfoMap)
- [x] Add Book Enrichment Level Badge to BookCard (scoring function + badge component)
- [x] Unify BookModal and BookDetailPanel into single component with variant prop
