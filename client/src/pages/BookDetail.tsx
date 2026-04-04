/**
 * BookDetail — Rich dedicated page for a single book at /book/:slug
 *
 * Sections:
 *   1. Hero: cover image, title, author, rating, publisher, category badge
 *   2. Rich Summary: full 3-4 paragraph LLM-generated summary
 *   3. Key Themes: theme chips with descriptions
 *   4. Key Quotes: blockquotes with context
 *   5. Similar Books: cards linking to their own detail pages
 *   6. Resource Links: all external links (Goodreads, Amazon, podcasts, videos, etc.)
 *   7. Library Content: content types available in Drive
 *   8. CTA: "Enrich this book" button (admin only)
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  ExternalLink,
  BookOpen,
  RefreshCw,
  ShoppingCart,
  Headphones,
  Video,
  FileText,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
  Quote,
  Lightbulb,
  BookMarked,
  ArrowRight,
  CheckCircle2,
  PenLine,
  Save,
} from "lucide-react";
import { BOOKS, CATEGORY_COLORS, CATEGORY_ICONS, CONTENT_TYPE_ICONS } from "@/lib/libraryData";
import { ICON_MAP, CT_ICON_MAP, normalizeContentTypes } from "@/components/library/libraryConstants";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unslugify(slug: string, books: typeof BOOKS) {
  return books.find((b) => slugify(b.name) === slug);
}

function displayTitle(name: string) {
  const idx = name.indexOf(" - ");
  return idx !== -1 ? name.slice(0, idx) : name;
}

function displayAuthor(name: string) {
  const idx = name.indexOf(" - ");
  return idx !== -1 ? name.slice(idx + 3) : "";
}

// ── Resource link icon ────────────────────────────────────────────────────────

function ResourceIcon({ type }: { type: string }) {
  switch (type) {
    case "purchase": return <ShoppingCart size={14} />;
    case "podcast": return <Headphones size={14} />;
    case "video": return <Video size={14} />;
    case "summary": return <FileText size={14} />;
    case "review": return <Star size={14} />;
    case "author": return <BookOpen size={14} />;
    default: return <Globe size={14} />;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BookDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const book = unslugify(slug ?? "", BOOKS);

  const title = book ? displayTitle(book.name) : "";
  const authorName = book ? displayAuthor(book.name) : "";

  const [showAllThemes, setShowAllThemes] = useState(false);
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Reading progress state
  const [progressValue, setProgressValue] = useState<number>(0);
  const [personalNotes, setPersonalNotes] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const progressInitialized = useRef(false);

  // Fetch book profile (cover, summary, rating, publisher, etc.)
  const { data: profile, refetch: refetchProfile } = trpc.bookProfiles.get.useQuery(
    { bookTitle: title },
    { enabled: !!title }
  );

  // Fetch rich summary (double-pass LLM)
  const { data: richData, refetch: refetchRich } = trpc.bookProfiles.getRichSummary.useQuery(
    { bookTitle: title },
    { enabled: !!title }
  );

  // Sync progress from DB once profile loads
  useEffect(() => {
    if (profile && !progressInitialized.current) {
      progressInitialized.current = true;
      setProgressValue(profile.readingProgressPercent ?? 0);
      if (profile.personalNotesJson) {
        try {
          const parsed = JSON.parse(profile.personalNotesJson as string);
          setPersonalNotes(parsed.notes ?? "");
        } catch { /* ignore */ }
      }
    }
  }, [profile]);

  const updateProgressMutation = trpc.bookProfiles.updateReadingProgress.useMutation({
    onSuccess: () => {
      toast.success("Progress saved!");
      setSavingProgress(false);
      setNotesEditing(false);
      refetchProfile();
    },
    onError: () => {
      toast.error("Failed to save progress");
      setSavingProgress(false);
    },
  });

  function saveProgress(overrides?: { percent?: number; notes?: string }) {
    if (!title) return;
    setSavingProgress(true);
    const pct = overrides?.percent ?? progressValue;
    updateProgressMutation.mutate({
      bookTitle: title,
      readingProgressPercent: pct,
      personalNotes: overrides?.notes ?? personalNotes,
      ...(pct === 100 && !profile?.readingFinishedAt ? { readingFinishedAt: new Date() } : {}),
      ...(pct > 0 && !profile?.readingStartedAt ? { readingStartedAt: new Date() } : {}),
    });
  }

  const enrichRichMutation = trpc.bookProfiles.enrichRichSummary.useMutation({
    onSuccess: (result) => {
      if (result.status === "enriched") {
        toast.success("Rich summary generated!");
        refetchRich();
        refetchProfile();
      } else {
        toast.info("Already enriched. Use force=true to re-enrich.");
      }
      setEnriching(false);
    },
    onError: () => {
      toast.error("Enrichment failed");
      setEnriching(false);
    },
  });

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col">
        <PageHeader crumbs={[{ label: "Books", href: "/" }, { label: "Not Found" }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <BookOpen size={48} className="mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Book not found</h2>
            <p className="text-muted-foreground">The book you're looking for doesn't exist in the library.</p>
            <Button onClick={() => setLocation("/")}>Back to Library</Button>
          </div>
        </div>
      </div>
    );
  }

  const color = CATEGORY_COLORS[book.category] ?? "#888";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const CategoryIcon = ICON_MAP[iconName] ?? BookMarked;

  const coverUrl = profile?.s3CoverUrl ?? profile?.coverImageUrl;
  const rating = profile?.rating ? parseFloat(profile.rating) : null;
  const ratingCount = profile?.ratingCount;

  // Parse rich summary data
  let richSummary: {
    fullSummary?: string;
    keyThemes?: { theme: string; description: string }[];
    keyQuotes?: { quote: string; context?: string }[];
    similarBooks?: { title: string; author: string; reason: string }[];
    resourceLinks?: { label: string; url: string; type: string }[];
  } | null = null;

  if (richData?.richSummaryJson) {
    try {
      richSummary = JSON.parse(richData.richSummaryJson);
    } catch { /* ignore */ }
  }

  const themes = richSummary?.keyThemes ?? [];
  const quotes = richSummary?.keyQuotes ?? [];
  const similarBooks = richSummary?.similarBooks ?? [];
  const resourceLinks = richSummary?.resourceLinks ?? [];

  const visibleThemes = showAllThemes ? themes : themes.slice(0, 4);
  const visibleQuotes = showAllQuotes ? quotes : quotes.slice(0, 2);

  const contentTypesMap = normalizeContentTypes(book.contentTypes);
  const contentTypes = Object.entries(contentTypesMap) as [string, number][];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader
        crumbs={[
          { label: "Library", href: "/" },
          { label: book.category, href: "/" },
          { label: title },
        ]}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-10">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-8"
        >
          {/* Cover */}
          <div className="shrink-0 flex justify-center md:justify-start">
            <div
              className="w-44 h-64 rounded-xl overflow-hidden shadow-2xl border border-border/40 flex items-center justify-center"
              style={{ background: `${color}18` }}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={`${title} cover`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
                  <CategoryIcon size={40} style={{ color }} />
                  <span className="text-xs font-medium">{title}</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Badge
                className="text-xs font-medium px-2 py-0.5"
                style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}
                variant="outline"
              >
                <CategoryIcon size={11} className="mr-1" />
                {book.category}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">{title}</h1>
              {authorName && (
                <button
                  onClick={() => setLocation(`/author/${slugify(authorName)}`)}
                  className="text-lg text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  by {authorName}
                </button>
              )}
            </div>

            {/* Rating */}
            {rating !== null && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
                {ratingCount && (
                  <span className="text-sm text-muted-foreground">
                    ({ratingCount.toLocaleString()} ratings)
                  </span>
                )}
              </div>
            )}

            {/* Publisher / Date */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {profile?.publisher && <span className="font-medium">{profile.publisher}</span>}
              {profile?.publishedDate && <span>{profile.publishedDate}</span>}
              {profile?.isbn && <span>ISBN: {profile.isbn}</span>}
            </div>

            {/* Content types in library */}
            {contentTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contentTypes.map(([ct, count]) => {
                  const ctIconName = CONTENT_TYPE_ICONS[ct] ?? "file";
                  const CtIcon = CT_ICON_MAP[ctIconName] ?? FileText;
                  return (
                    <Badge key={ct} variant="secondary" className="text-xs gap-1">
                      <CtIcon size={11} />
                      {ct} ({count})
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2 shadow-sm active:translate-y-px"
                onClick={() => window.open(`https://drive.google.com/drive/folders/${book.id}?view=grid`, "_blank")}
              >
                <BookOpen size={14} />
                Open in Drive
              </Button>
              {profile?.amazonUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 shadow-sm active:translate-y-px"
                  onClick={() => window.open(profile.amazonUrl!, "_blank")}
                >
                  <ShoppingCart size={14} />
                  Amazon
                </Button>
              )}
              {profile?.goodreadsUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 shadow-sm active:translate-y-px"
                  onClick={() => window.open(profile.goodreadsUrl!, "_blank")}
                >
                  <Star size={14} />
                  Goodreads
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 shadow-sm active:translate-y-px"
                  disabled={enriching}
                  onClick={() => {
                    setEnriching(true);
                    enrichRichMutation.mutate({ bookTitle: title, authorName });
                  }}
                >
                  {enriching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {richSummary ? "Re-enrich" : "Generate Rich Summary"}
                </Button>
              )}
            </div>
          </div>
        </motion.section>

        <Separator />

        {/* ── Summary ──────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen size={20} style={{ color }} />
            About This Book
          </h2>
          {richSummary?.fullSummary ? (
            <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed space-y-3">
              {richSummary.fullSummary.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : profile?.summary ? (
            <p className="text-foreground/90 leading-relaxed">{profile.summary}</p>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No summary available yet.</p>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-2"
                  disabled={enriching}
                  onClick={() => {
                    setEnriching(true);
                    enrichRichMutation.mutate({ bookTitle: title, authorName });
                  }}
                >
                  {enriching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Generate Summary
                </Button>
              )}
            </div>
          )}
        </section>

        {/* ── Key Themes ───────────────────────────────────────────────────── */}
        {themes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Lightbulb size={20} style={{ color }} />
              Key Themes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {visibleThemes.map((theme, i) => (
                  <motion.div
                    key={theme.theme}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-border/60 p-4 hover:border-border transition-colors"
                    style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                  >
                    <p className="font-semibold text-sm mb-1" style={{ color }}>{theme.theme}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{theme.description}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {themes.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllThemes(!showAllThemes)}
              >
                {showAllThemes ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show {themes.length - 4} more</>}
              </Button>
            )}
          </section>
        )}

        {/* ── Key Quotes ───────────────────────────────────────────────────── */}
        {quotes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Quote size={20} style={{ color }} />
              Notable Quotes
            </h2>
            <div className="space-y-4">
              <AnimatePresence>
                {visibleQuotes.map((q, i) => (
                  <motion.blockquote
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="border-l-4 pl-5 py-2 italic text-foreground/80"
                    style={{ borderLeftColor: color }}
                  >
                    <p className="text-base leading-relaxed">"{q.quote}"</p>
                    {q.context && (
                      <footer className="mt-2 text-sm text-muted-foreground not-italic">— {q.context}</footer>
                    )}
                  </motion.blockquote>
                ))}
              </AnimatePresence>
            </div>
            {quotes.length > 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllQuotes(!showAllQuotes)}
              >
                {showAllQuotes ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show {quotes.length - 2} more</>}
              </Button>
            )}
          </section>
        )}

        {/* ── Similar Books ────────────────────────────────────────────────── */}
        {similarBooks.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookMarked size={20} style={{ color }} />
              You Might Also Like
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {similarBooks.map((sb, i) => {
                const matchedBook = BOOKS.find(
                  (b) => displayTitle(b.name).toLowerCase() === sb.title.toLowerCase()
                );
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-xl border border-border/60 p-4 hover:border-border hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => {
                      if (matchedBook) {
                        setLocation(`/book/${slugify(matchedBook.name)}`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">{sb.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">by {sb.author}</p>
                      </div>
                      {matchedBook && (
                        <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{sb.reason}</p>
                    {matchedBook && (
                      <Badge variant="secondary" className="mt-2 text-xs">In Library</Badge>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Resource Links ───────────────────────────────────────────────── */}
        {resourceLinks.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Globe size={20} style={{ color }} />
              Resources & Links
            </h2>
            <div className="flex flex-wrap gap-3">
              {resourceLinks.map((link, i) => (
                <motion.a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 text-sm font-medium hover:border-border hover:shadow-sm hover:bg-accent/30 transition-all active:scale-95"
                >
                  <ResourceIcon type={link.type} />
                  {link.label}
                  <ExternalLink size={11} className="text-muted-foreground" />
                </motion.a>
              ))}
            </div>
          </section>
        )}

        {/* ── Reading Progress ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 size={20} style={{ color }} />
            Reading Progress
          </h2>
          <div className="rounded-xl border border-border/60 p-5 space-y-5">
            {/* Progress bar + percentage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progressValue === 0 ? "Not started" : progressValue === 100 ? "Finished" : `${progressValue}% complete`}
                </span>
                <span className="font-semibold tabular-nums" style={{ color }}>{progressValue}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progressValue}
                onChange={(e) => setProgressValue(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                style={{ accentColor: color }}
              />
              <div className="flex gap-2 flex-wrap">
                {[0, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => { setProgressValue(pct); saveProgress({ percent: pct }); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      progressValue === pct
                        ? "border-transparent text-white font-semibold"
                        : "border-border/60 text-muted-foreground hover:border-border"
                    }`}
                    style={progressValue === pct ? { backgroundColor: color } : {}}
                  >
                    {pct === 0 ? "Not started" : pct === 100 ? "Finished" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            {(profile?.readingStartedAt || profile?.readingFinishedAt) && (
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.readingStartedAt && (
                  <span>Started: <strong className="text-foreground">{new Date(profile.readingStartedAt).toLocaleDateString()}</strong></span>
                )}
                {profile.readingFinishedAt && (
                  <span>Finished: <strong className="text-foreground">{new Date(profile.readingFinishedAt).toLocaleDateString()}</strong></span>
                )}
              </div>
            )}

            {/* Save button */}
            <Button
              size="sm"
              onClick={() => saveProgress()}
              disabled={savingProgress}
              className="gap-2"
              style={{ backgroundColor: color, borderColor: color }}
            >
              {savingProgress ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Progress
            </Button>
          </div>
        </section>

        {/* ── Personal Notes ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <PenLine size={20} style={{ color }} />
              My Notes
            </h2>
            {!notesEditing && (
              <Button size="sm" variant="outline" onClick={() => setNotesEditing(true)} className="gap-2">
                <PenLine size={13} />
                {personalNotes ? "Edit" : "Add Notes"}
              </Button>
            )}
          </div>
          <div className="rounded-xl border border-border/60 p-5">
            {notesEditing ? (
              <div className="space-y-3">
                <textarea
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  placeholder="Your thoughts, highlights, key takeaways..."
                  rows={6}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveProgress({ notes: personalNotes })}
                    disabled={savingProgress}
                    className="gap-2"
                    style={{ backgroundColor: color, borderColor: color }}
                  >
                    {savingProgress ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Save Notes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNotesEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : personalNotes ? (
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{personalNotes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No personal notes yet. Click "Add Notes" to capture your thoughts.</p>
            )}
          </div>
        </section>

        {/* ── Library Content ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen size={20} style={{ color }} />
            In Your Library
          </h2>
          <div className="rounded-xl border border-border/60 p-5 space-y-3">
            <div className="flex flex-wrap gap-3">
              {contentTypes.length > 0 ? contentTypes.map(([ct, count]) => {
                const ctIconName = CONTENT_TYPE_ICONS[ct] ?? "file";
                const CtIcon = CT_ICON_MAP[ctIconName] ?? FileText;
                return (
                  <div
                    key={ct}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 text-sm"
                  >
                    <CtIcon size={14} style={{ color }} />
                    <span className="font-medium">{ct}</span>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground">No content types recorded.</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 shadow-sm active:translate-y-px"
              onClick={() => window.open(`https://drive.google.com/drive/folders/${book.id}?view=grid`, "_blank")}
            >
              <ExternalLink size={14} />
              Open Folder in Google Drive
            </Button>
          </div>
        </section>

      </main>
    </div>
  );
}
