/**
 * AI File Classifier Service
 *
 * Uses Claude claude-opus-4-5 to analyse uploaded files and determine:
 * - Content type (book PDF, author avatar, podcast, etc.)
 * - Associated author and/or book
 * - Target DB table and columns
 * - Whether to index in Neon (and which namespace)
 * - Suggested Dropbox destination path
 *
 * For images and PDFs, we pass the file content to Claude as base64.
 * For audio/video, we use only filename + metadata (no content extraction).
 */

import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import { like, or, sql } from "drizzle-orm";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Classification Result Schema ──────────────────────────────────────────────

export interface FileClassification {
  contentType:
    | "book_pdf"
    | "book_audio"
    | "book_cover"
    | "author_avatar"
    | "author_bio"
    | "article_pdf"
    | "podcast_audio"
    | "video"
    | "research_paper"
    | "newsletter"
    | "transcript"
    | "design_asset"
    | "unknown";
  confidence: number; // 0–100
  reasoning: string;
  suggestedAuthorName: string | null;
  suggestedBookTitle: string | null;
  targetTable: "author_profiles" | "book_profiles" | "content_files" | "content_items" | "rag_files" | null;
  shouldIndexPinecone: boolean;
  neonNamespace: "authors" | "books" | "content_items" | "rag_files" | null;
  suggestedDropboxPath: string | null;
  extractedText: string | null; // first ~500 chars of extracted text for preview
  tags: string[];
}

// ── Author/Book Lookup ────────────────────────────────────────────────────────

async function findMatchingAuthor(name: string): Promise<{ id: number; name: string } | null> {
  if (!name) return null;
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select({ id: authorProfiles.id, name: authorProfiles.authorName })
    .from(authorProfiles)
    .where(
      or(
        like(authorProfiles.authorName, `%${name}%`),
        like(sql`LOWER(${authorProfiles.authorName})`, `%${name.toLowerCase()}%`)
      )
    )
    .limit(1);
  return results[0] ?? null;
}

async function findMatchingBook(title: string): Promise<{ id: number; title: string } | null> {
  if (!title) return null;
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select({ id: bookProfiles.id, title: bookProfiles.bookTitle })
    .from(bookProfiles)
    .where(
      or(
        like(bookProfiles.bookTitle, `%${title}%`),
        like(sql`LOWER(${bookProfiles.bookTitle})`, `%${title.toLowerCase()}%`)
      )
    )
    .limit(1);
  return results[0] ?? null;
}

// ── Dropbox Path Suggestion ───────────────────────────────────────────────────

function suggestDropboxPath(
  contentType: FileClassification["contentType"],
  authorName: string | null,
  bookTitle: string | null
): string {
  const base = "/Apps NAI/RC Library App Data/Authors and Books Backup";
  const sanitize = (s: string) => s.replace(/[/\\:*?"<>|]/g, "_").trim();

  if (authorName) {
    const authorSlug = sanitize(authorName);
    switch (contentType) {
      case "book_pdf":
      case "book_audio":
        return bookTitle
          ? `${base}/${authorSlug}/${sanitize(bookTitle)}`
          : `${base}/${authorSlug}/Books`;
      case "book_cover":
        return `${base}/${authorSlug}/Covers`;
      case "author_avatar":
        return `${base}/${authorSlug}/Avatar`;
      case "author_bio":
        return `${base}/${authorSlug}/Bio`;
      case "article_pdf":
      case "newsletter":
        return `${base}/${authorSlug}/Articles`;
      case "podcast_audio":
        return `${base}/${authorSlug}/Podcasts`;
      case "video":
        return `${base}/${authorSlug}/Videos`;
      case "research_paper":
        return `${base}/${authorSlug}/Research`;
      case "transcript":
        return `${base}/${authorSlug}/Transcripts`;
      default:
        return `${base}/${authorSlug}`;
    }
  }

  // No author — use content entry folders
  if (contentType === "book_pdf" || contentType === "book_audio" || contentType === "book_cover") {
    return "/Apps NAI/RC Library App Data/Books Content Entry Folder";
  }
  return "/Apps NAI/RC Library App Data/Authors Content Entry Folder";
}

// ── Main Classifier ───────────────────────────────────────────────────────────

export async function classifyFile(params: {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  /** Base64-encoded file content (for images and PDFs up to ~4MB) */
  base64Content?: string;
  /** First 2000 chars of extracted text (for PDFs) */
  extractedText?: string;
}): Promise<FileClassification> {
  const { filename, mimeType, fileSizeBytes, base64Content, extractedText } = params;

  // Build the classification prompt
  const systemPrompt = `You are an expert librarian AI for the RC Library, a digital library of 187 authors and 163 books focused on business, psychology, leadership, and technology.

Your task is to classify an uploaded file and determine:
1. What type of content it is
2. Which author and/or book it belongs to
3. Where it should be stored in the database
4. Whether it should be indexed in Neon pgvector for semantic search

Content types you must choose from:
- book_pdf: Full text of a book in PDF format
- book_audio: Audiobook file (MP3/MP4/M4A)
- book_cover: Book cover image (JPG/PNG/WEBP)
- author_avatar: Author headshot/portrait photo
- author_bio: Author biography document
- article_pdf: Article, essay, or column in PDF
- podcast_audio: Podcast episode audio
- video: Video content (talk, interview, course)
- research_paper: Academic or research paper
- newsletter: Newsletter issue (PDF or text)
- transcript: Text transcript of audio/video
- design_asset: Logo, banner, UI asset
- unknown: Cannot determine

Database routing rules:
- book_pdf, book_audio → content_files (linked to book_profiles)
- book_cover → book_profiles.coverImageUrl
- author_avatar → author_profiles.avatarUrl
- author_bio → author_profiles.bio (text extraction)
- article_pdf, newsletter, research_paper → content_files (linked to content_items)
- podcast_audio, video → content_files (linked to content_items)
- transcript → rag_files (for Marcela chatbot RAG)
- design_asset → content_files

Neon pgvector indexing rules:
- author_bio → namespace: authors
- book_pdf (extract summary) → namespace: books
- article_pdf, newsletter, research_paper → namespace: content_items
- transcript → namespace: rag_files
- All others → do NOT index

Respond ONLY with a valid JSON object matching this exact schema:
{
  "contentType": "<one of the types above>",
  "confidence": <0-100>,
  "reasoning": "<1-2 sentences explaining your classification>",
  "suggestedAuthorName": "<full author name or null>",
  "suggestedBookTitle": "<full book title or null>",
  "targetTable": "<table name or null>",
  "shouldIndexPinecone": <true|false>,
  "neonNamespace": "<namespace or null>",
  "extractedText": "<first 500 chars of meaningful text or null>",
  "tags": ["<tag1>", "<tag2>"]
}`;

  const userContent: Anthropic.MessageParam["content"] = [];

  // Add text description
  userContent.push({
    type: "text",
    text: `Classify this file:
Filename: ${filename}
MIME type: ${mimeType}
File size: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB
${extractedText ? `\nExtracted text preview:\n${extractedText.slice(0, 2000)}` : ""}`,
  });

  // Add image content if available and it's an image
  if (base64Content && mimeType.startsWith("image/")) {
    const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Content,
      },
    });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const classification = JSON.parse(jsonStr) as FileClassification;

    // Suggest Dropbox path based on classification
    classification.suggestedDropboxPath = suggestDropboxPath(
      classification.contentType,
      classification.suggestedAuthorName,
      classification.suggestedBookTitle
    );

    return classification;
  } catch (err) {
    console.error("[AI Classifier] Error:", err);
    return {
      contentType: "unknown",
      confidence: 0,
      reasoning: `Classification failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      suggestedAuthorName: null,
      suggestedBookTitle: null,
      targetTable: null,
      shouldIndexPinecone: false,
      neonNamespace: null,
      suggestedDropboxPath: null,
      extractedText: null,
      tags: [],
    };
  }
}

// ── DB Match Enrichment ───────────────────────────────────────────────────────

export async function enrichClassificationWithDbMatches(
  classification: FileClassification
): Promise<{
  matchedAuthorId: number | null;
  matchedBookId: number | null;
}> {
  const [matchedAuthor, matchedBook] = await Promise.all([
    classification.suggestedAuthorName
      ? findMatchingAuthor(classification.suggestedAuthorName)
      : Promise.resolve(null),
    classification.suggestedBookTitle
      ? findMatchingBook(classification.suggestedBookTitle)
      : Promise.resolve(null),
  ]);

  return {
    matchedAuthorId: matchedAuthor?.id ?? null,
    matchedBookId: matchedBook?.id ?? null,
  };
}
