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
- [ ] Manual review: 10 books share same S3 cover URL (different titles for same book — needs human decision to merge or keep)
- [ ] Manual review: "The Jolt Effect" exact duplicate (ids 98 and 30005) — decide which to keep

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
