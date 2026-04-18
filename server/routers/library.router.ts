/**
 * Library regeneration router
 * Scans Google Drive Authors and Books Audio folders via the gws CLI,
 * rebuilds libraryData.ts and audioData.ts, and returns a summary.
 */
import { logger } from "../lib/logger";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import { sql } from "drizzle-orm";
import { validateAuthorName } from "../../shared/authorNameValidator";

// -- Constants ------------------------------------------------
// Folder IDs are configurable via DRIVE_AUTHORS_FOLDER_ID / DRIVE_BOOKS_AUDIO_FOLDER_ID env vars
const AUTHORS_ROOT = ENV.driveAuthorsFolderId;
const BOOKS_AUDIO_ROOT = ENV.driveBooksAudioFolderId;

const AUDIO_FOLDER_NAMES = new Set([
  "audio mp3", "audible", "mp3", "audiable", "audio mb4", "audio",
  "audible mp3", "audio m4b",
]);

const CONTENT_TYPE_NORMALIZE: Record<string, string> = {
  "book pdf": "PDF",
  "pdf extra": "PDF",
  "bonus pdf": "PDF",
  "transcript doc": "Transcript",
  "transcript pdf": "Transcript",
  "book doc": "Transcript",
  "doc": "DOC",
  "book doc por br": "Supplemental",
  "supplemental": "Supplemental",
  "images": "Images",
  "image": "Images",
  "video": "Video",
  "binder": "Binder",
  "summary": "Summary",
  "papers": "Papers",
  "paper": "Papers",
  "research papers": "Papers",
  "articles": "Articles",
  "article": "Articles",
  "links": "Links",
  "link": "Links",
  "web links": "Links",
  "other": "Other",
  "pdf": "PDF",
  "transcript": "Transcript",
  // Publishing platforms
  "substack": "Substack",
  "substack posts": "Substack",
  "substack articles": "Substack",
  "medium": "Medium",
  "medium posts": "Medium",
  "medium articles": "Medium",
  "blog": "Blog",
  "blog posts": "Blog",
  "newsletter": "Newsletter",
  "newsletters": "Newsletter",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Business & Entrepreneurship": "#b45309",
  "Behavioral Science & Psychology": "#7c3aed",
  "Sales & Negotiation": "#0369a1",
  "Leadership & Management": "#065f46",
  "Self-Help & Productivity": "#b91c1c",
  "Communication & Storytelling": "#c2410c",
  "Technology & Futurism": "#1d4ed8",
  "Strategy & Economics": "#374151",
  "History & Biography": "#92400e",
};

const CATEGORY_BG: Record<string, string> = {
  "Business & Entrepreneurship": "#fef9ec",
  "Behavioral Science & Psychology": "#f5f3ff",
  "Sales & Negotiation": "#eff8ff",
  "Leadership & Management": "#f0fdf4",
  "Self-Help & Productivity": "#fff1f2",
  "Communication & Storytelling": "#fff7ed",
  "Technology & Futurism": "#eff6ff",
  "Strategy & Economics": "#f8fafc",
  "History & Biography": "#fdf8f0",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Business & Entrepreneurship": "briefcase",
  "Behavioral Science & Psychology": "brain",
  "Sales & Negotiation": "handshake",
  "Leadership & Management": "users",
  "Self-Help & Productivity": "zap",
  "Communication & Storytelling": "message-circle",
  "Technology & Futurism": "cpu",
  "Strategy & Economics": "trending-up",
  "History & Biography": "book-open",
};

// -- Drive helpers ---------------------------------------------
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

function gwsList(parentId: string, retries = 3): DriveFile[] {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const params = JSON.stringify({
        q: `"${parentId}" in parents and trashed = false`,
        fields: "files(id,name,mimeType)",
        pageSize: 200,
      });
      const out = execSync(`gws drive files list --params '${params}'`, {
        encoding: "utf8",
        timeout: 30000,
      });
      const data = JSON.parse(out);
      if (data.error) {
        if (attempt < retries - 1) continue;
        return [];
      }
      return data.files ?? [];
    } catch {
      if (attempt < retries - 1) continue;
      return [];
    }
  }
  return [];
}

function isFolder(item: DriveFile): boolean {
  return item.mimeType.includes("folder");
}

function countFilesInFolder(folderId: string): number {
  const items = gwsList(folderId);
  let count = 0;
  for (const item of items) {
    if (isFolder(item)) {
      count += countFilesInFolder(item.id);
    } else {
      count += 1;
    }
  }
  return count;
}

function normalizeContentType(rawName: string): string {
  const key = rawName.toLowerCase().trim();
  return CONTENT_TYPE_NORMALIZE[key] ?? rawName;
}

// -- Scan Authors ----------------------------------------------
interface BookEntry {
  name: string;
  id: string;
  contentTypes: Record<string, number>;
}

interface AuthorEntry {
  name: string;
  id: string;
  category: string;
  books: BookEntry[];
}

interface BookRecord {
  name: string;
  id: string;
  category: string;
  contentTypes: Record<string, number>;
}

function scanAuthors(): { authors: AuthorEntry[]; books: BookRecord[] } {
  const authors: AuthorEntry[] = [];
  const books: BookRecord[] = [];

  // Skip support/asset folders that live alongside category folders
  const SKIP_FOLDERS = new Set(["bios", "book covers", "author pictures", "authors", "avatars", "photos"]);
  const categoryFolders = gwsList(AUTHORS_ROOT)
    .filter(isFolder)
    .filter((f) => !SKIP_FOLDERS.has(f.name.toLowerCase().trim()));

  for (const catFolder of categoryFolders) {
    const category = catFolder.name;
    const authorFolders = gwsList(catFolder.id).filter(isFolder);

    for (const authorFolder of authorFolders) {
      const authorChildren = gwsList(authorFolder.id).filter(isFolder);

      // Detect depth-collapse: if all children are content-type folders, treat as single book
      const contentTypeNames = new Set(Object.keys(CONTENT_TYPE_NORMALIZE));
      const allAreContentTypes = authorChildren.every((c) => {
        const key = c.name.toLowerCase().trim();
        return contentTypeNames.has(key) || AUDIO_FOLDER_NAMES.has(key);
      });

      // Guardrail: skip Drive folders whose name is not a plausible person name
      const nameValidation = validateAuthorName(authorFolder.name);
      if (!nameValidation.valid) {
        logger.warn(`[library.scanner] Skipping non-person folder "${authorFolder.name}": ${nameValidation.reason}`);
        continue;
      }

      const authorEntry: AuthorEntry = {
        name: authorFolder.name,
        id: authorFolder.id,
        category,
        books: [],
      };

      if (allAreContentTypes && authorChildren.length > 0) {
        // Collapsed: content-type folders directly under author
        const contentTypes: Record<string, number> = {};
        for (const ctFolder of authorChildren) {
          if (AUDIO_FOLDER_NAMES.has(ctFolder.name.toLowerCase().trim())) continue;
          const normalized = normalizeContentType(ctFolder.name);
          const count = countFilesInFolder(ctFolder.id);
          if (count > 0) {
            contentTypes[normalized] = (contentTypes[normalized] ?? 0) + count;
          }
        }
        if (Object.keys(contentTypes).length > 0) {
          authorEntry.books.push({
            name: authorFolder.name,
            id: authorFolder.id,
            contentTypes,
          });
        }
      } else {
        // Normal: book folders under author
        for (const bookFolder of authorChildren) {
          if (AUDIO_FOLDER_NAMES.has(bookFolder.name.toLowerCase().trim())) continue;

          const ctFolders = gwsList(bookFolder.id).filter(isFolder);
          const contentTypes: Record<string, number> = {};

          if (ctFolders.length === 0) {
            // No subfolders - count files directly
            const count = countFilesInFolder(bookFolder.id);
            if (count > 0) contentTypes["Other"] = count;
          } else {
            for (const ctFolder of ctFolders) {
              if (AUDIO_FOLDER_NAMES.has(ctFolder.name.toLowerCase().trim())) continue;
              const normalized = normalizeContentType(ctFolder.name);
              const count = countFilesInFolder(ctFolder.id);
              if (count > 0) {
                contentTypes[normalized] = (contentTypes[normalized] ?? 0) + count;
              }
            }
          }

          authorEntry.books.push({
            name: bookFolder.name,
            id: bookFolder.id,
            contentTypes,
          });

          // Also add to flat books list
          books.push({
            name: `${bookFolder.name} - ${authorFolder.name}`,
            id: bookFolder.id,
            category,
            contentTypes,
          });
        }
      }

      authors.push(authorEntry);
    }
  }

  authors.sort((a, b) => a.name.localeCompare(b.name));
  books.sort((a, b) => a.name.localeCompare(b.name));

  return { authors, books };
}

// -- Scan Books Audio ------------------------------------------
interface AudioFormat {
  folderId: string;
  fileCount: number;
}

interface AudioBook {
  id: string;
  title: string;
  bookAuthors: string;
  formats: Record<string, AudioFormat>;
}

function scanAudio(): AudioBook[] {
  const audioBooks: AudioBook[] = [];
  const bookFolders = gwsList(BOOKS_AUDIO_ROOT).filter(isFolder);

  for (const bookFolder of bookFolders) {
    // Parse "Title - Author" from folder name
    const dashIdx = bookFolder.name.indexOf(" - ");
    const title = dashIdx !== -1 ? bookFolder.name.slice(0, dashIdx) : bookFolder.name;
    const bookAuthors = dashIdx !== -1 ? bookFolder.name.slice(dashIdx + 3) : "";

    const formatFolders = gwsList(bookFolder.id).filter(isFolder);
    const formats: Record<string, AudioFormat> = {};

    for (const fmtFolder of formatFolders) {
      const fmtName = fmtFolder.name.toUpperCase().replace(/\s+/g, "");
      const fileCount = countFilesInFolder(fmtFolder.id);
      if (fileCount > 0) {
        formats[fmtName] = { folderId: fmtFolder.id, fileCount };
      }
    }

    if (Object.keys(formats).length > 0) {
      audioBooks.push({
        id: bookFolder.id,
        title,
        bookAuthors,
        formats,
      });
    }
  }

  audioBooks.sort((a, b) => a.title.localeCompare(b.title));
  return audioBooks;
}

// -- TypeScript generators -------------------------------------
function generateLibraryTs(authors: AuthorEntry[], books: BookRecord[]): string {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  const tsRecord = (d: Record<string, number>) => {
    if (!d || Object.keys(d).length === 0) return "{}";
    return "{ " + Object.entries(d).map(([k, v]) => `"${k}": ${v}`).join(", ") + " }";
  };

  const tsBook = (b: BookEntry) =>
    `    { name: ${JSON.stringify(b.name)}, id: ${JSON.stringify(b.id)}, contentTypes: ${tsRecord(b.contentTypes)} }`;

  const tsAuthor = (a: AuthorEntry) => {
    const booksTs = a.books.map(tsBook).join(",\n");
    const booksBlock = a.books.length > 0 ? `[\n${booksTs}\n  ]` : "[]";
    return `  {\n    name: ${JSON.stringify(a.name)},\n    id: ${JSON.stringify(a.id)},\n    category: ${JSON.stringify(a.category)},\n    books: ${booksBlock}\n  }`;
  };

  const tsBookRecord = (b: BookRecord) =>
    `  { name: ${JSON.stringify(b.name)}, id: ${JSON.stringify(b.id)}, category: ${JSON.stringify(b.category)}, contentTypes: ${tsRecord(b.contentTypes)} }`;

  const colorsTs = Object.entries(CATEGORY_COLORS).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
  const bgTs = Object.entries(CATEGORY_BG).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
  const iconsTs = Object.entries(CATEGORY_ICONS).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");

  return `// NCG Knowledge Library - auto-generated from Google Drive scan
// Generated: ${now} UTC
// Design: Editorial Intelligence - Playfair Display + DM Sans, warm paper palette, 9-category system
export interface BookEntry {
  name: string;
  id: string;
  contentTypes: Record<string, number>;
}
export interface AuthorEntry {
  name: string;
  id: string;
  category: string;
  books: BookEntry[];
}
export interface BookRecord {
  name: string;
  id: string;
  category: string;
  contentTypes: Record<string, number>;
}
export const CATEGORY_COLORS: Record<string, string> = {
${colorsTs}
};
export const CATEGORY_BG: Record<string, string> = {
${bgTs}
};
export const CATEGORY_ICONS: Record<string, string> = {
${iconsTs}
};
export const CONTENT_TYPE_ICONS: Record<string, string> = {
  "PDF": "file-text",
  "Binder": "book",
  "Transcript": "align-left",
  "Summary": "list",
  "Supplemental": "package",
  "Video": "video",
  "Images": "image",
  "Papers": "scroll",
  "Articles": "newspaper",
  "Links": "link",
  "Substack": "rss",
  "Medium": "pen-line",
  "Blog": "pen-square",
  "Newsletter": "mail",
  "Other": "folder",
};
export const CONTENT_TYPE_COLORS: Record<string, string> = {
  "PDF": "#dc2626",
  "Binder": "#7c3aed",
  "Transcript": "#059669",
  "Summary": "#0891b2",
  "Supplemental": "#6b7280",
  "Video": "#db2777",
  "Images": "#0891b2",
  "Papers": "#0d9488",
  "Articles": "#78350f",
  "Links": "#4338ca",
  "Substack": "#ff6719",
  "Medium": "#00ab6c",
  "Blog": "#6366f1",
  "Newsletter": "#0ea5e9",
  "Other": "#9ca3af",
};
export const LIBRARY_STATS = {
  totalAuthors: ${authors.length},
  totalBooks: ${books.length},
  categories: 9,
};
export const AUTHORS: AuthorEntry[] = [
${authors.map(tsAuthor).join(",\n")}
];
export const BOOKS: BookRecord[] = [
${books.map(tsBookRecord).join(",\n")}
];
export const CATEGORIES: string[] = [
  "Behavioral Science & Psychology",
  "Business & Entrepreneurship",
  "Communication & Storytelling",
  "History & Biography",
  "Leadership & Management",
  "Sales & Negotiation",
  "Self-Help & Productivity",
  "Strategy & Economics",
  "Technology & Futurism",
];
`;
}

function generateAudioTs(audioBooks: AudioBook[]): string {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  const tsAudio = (a: AudioBook) => {
    const fmtsTs = Object.entries(a.formats)
      .map(([k, v]) => `"${k}": {"folderId": "${v.folderId}", "fileCount": ${v.fileCount}}`)
      .join(", ");
    return `  {\n    id: ${JSON.stringify(a.id)},\n    title: ${JSON.stringify(a.title)},\n    bookAuthors: ${JSON.stringify(a.bookAuthors)},\n    formats: {${fmtsTs}},\n  }`;
  };

  return `// NCG Library - Books Audio Data
// Source: Google Drive Books Audio folder
// Last updated: ${now} UTC
export interface AudioFormat {
  folderId: string;
  fileCount: number;
}
export interface AudioBook {
  id: string;
  title: string;
  bookAuthors: string;
  formats: Record<string, AudioFormat>;
}
export const AUDIO_BOOKS: AudioBook[] = [
${audioBooks.map(tsAudio).join(",\n")}
];
`;
}

// -- Router ----------------------------------------------------
const PROJECT_ROOT = path.resolve(process.cwd());
const LIBRARY_DATA_PATH = path.join(PROJECT_ROOT, "client", "src", "lib", "libraryData.ts");
const AUDIO_DATA_PATH = path.join(PROJECT_ROOT, "client", "src", "lib", "audioData.ts");

export const libraryRouter = router({
  /**
   * Returns live counts from the DB for the stat tiles on the home page.
   * Falls back to static libraryData.ts values if the DB is unavailable.
   */
  getStats: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return null;

      const [authorResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(authorProfiles);
      const [bookResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookProfiles);

      return {
        authors: Number(authorResult?.count ?? 0),
        books: Number(bookResult?.count ?? 0),
        categories: 9,
      };
    } catch {
      return null;
    }
  }),

  regenerate: adminProcedure.mutation(async () => {
    const startTime = Date.now();

    try {
      // Scan Authors
      const { authors, books } = scanAuthors();

      // Scan Books Audio
      const audioBooks = scanAudio();

      // Write files
      const libraryTs = generateLibraryTs(authors, books);
      const audioTs = generateAudioTs(audioBooks);

      fs.writeFileSync(LIBRARY_DATA_PATH, libraryTs, "utf8");
      fs.writeFileSync(AUDIO_DATA_PATH, audioTs, "utf8");

      const elapsed = Math.round((Date.now() - startTime) / 1000);

      return {
        success: true,
        stats: {
          authors: authors.length,
          books: books.length,
          audioBooks: audioBooks.length,
          elapsedSeconds: elapsed,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, stats: null };
    }
  }),
});
