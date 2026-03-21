/**
 * Book enrichment helpers: Google Books API + LLM fallback.
 *
 * Extracted from bookProfiles.router.ts to keep the router under 150 lines.
 * Used by:
 *   - bookProfiles.router.ts (enrich, enrichBatch procedures)
 *   - Any future enrichment jobs or scripts
 */
import { invokeLLM } from "../_core/llm";

// -- Types ---------------------------------------------------------------------

interface BookEnrichmentData {
  summary: string;
  keyThemes: string;
  rating: string;
  ratingCount: string;
  amazonUrl: string;
  goodreadsUrl: string;
  resourceUrl: string;
  resourceLabel: string;
  coverImageUrl: string;
  publishedDate: string;
  isbn: string;
  publisher: string;
}

// -- Google Books API ----------------------------------------------------------

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
    };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    infoLink?: string;
  };
}

interface GoogleBooksResponse {
  totalItems?: number;
  items?: GoogleBooksVolume[];
}

/**
 * Generate book summary using LLM when Google Books returns nothing.
 */
async function generateBookSummaryWithLLM(bookTitle: string, authorName: string, model?: string): Promise<string> {
  try {
    const result = await invokeLLM({
      model,
      messages: [
        {
          role: "system",
          content: "You are a concise book reference assistant. Write factual, engaging book summaries in 2-3 sentences. Focus on the book's main argument, target audience, and key takeaway.",
        },
        {
          role: "user",
          content: `Write a 2-sentence summary for the book "${bookTitle}" by ${authorName || "unknown author"}. Focus on the main thesis and what readers will gain. Keep it under 400 characters.`,
        },
      ],
    });
    const raw = result?.choices?.[0]?.message?.content ?? "";
    const content = typeof raw === "string" ? raw : "";
    return content.trim().slice(0, 600);
  } catch (err) {
    console.error(`[bookEnrich] LLM summary generation failed for "${bookTitle}":`, err);
    return "";
  }
}

/**
 * Fetch book data from Google Books API (no API key required for basic queries).
 * Returns enriched metadata including cover image URL, summary, and publication info.
 * Falls back to LLM-generated summary when Google Books returns no description.
 */
export async function enrichBookViaGoogleBooks(
  bookTitle: string,
  authorName: string,
  model?: string
): Promise<BookEnrichmentData> {
  const result: BookEnrichmentData = {
    summary: "",
    keyThemes: "",
    rating: "",
    ratingCount: "",
    amazonUrl: "",
    goodreadsUrl: "",
    resourceUrl: "",
    resourceLabel: "",
    coverImageUrl: "",
    publishedDate: "",
    isbn: "",
    publisher: "",
  };

  try {
    // Build search query: title + author for best match
    const query = authorName
      ? `intitle:${encodeURIComponent(bookTitle)}+inauthor:${encodeURIComponent(authorName)}`
      : `intitle:${encodeURIComponent(bookTitle)}`;

    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3&printType=books&langRestrict=en`;

    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "NCG-Library/1.0" },
    });

    if (!res.ok) {
      console.error(`[bookEnrich] Google Books API returned ${res.status} for "${bookTitle}"`);
      return result;
    }

    const data = (await res.json()) as GoogleBooksResponse;
    const items = data.items ?? [];

    if (items.length === 0) {
      // Try a broader search without intitle/inauthor
      const broadQuery = encodeURIComponent(`${bookTitle} ${authorName}`);
      const broadUrl = `https://www.googleapis.com/books/v1/volumes?q=${broadQuery}&maxResults=3&printType=books&langRestrict=en`;
      const broadRes = await fetch(broadUrl, { headers: { "User-Agent": "NCG-Library/1.0" } });
      if (broadRes.ok) {
        const broadData = (await broadRes.json()) as GoogleBooksResponse;
        items.push(...(broadData.items ?? []));
      }
    }

    if (items.length === 0) return result;

    // Pick the best match: prefer exact title match
    const titleLower = bookTitle.toLowerCase();
    const best =
      items.find((v) => v.volumeInfo.title?.toLowerCase().includes(titleLower)) ?? items[0];

    const info = best.volumeInfo;

    // Summary: strip HTML tags from description
    if (info.description) {
      const clean = info.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      result.summary = clean.slice(0, 600);
    }

    // Key themes from categories
    if (info.categories?.length) {
      result.keyThemes = info.categories.slice(0, 5).join(", ");
    }

    // Rating
    if (info.averageRating) {
      result.rating = info.averageRating.toFixed(1);
    }
    if (info.ratingsCount) {
      result.ratingCount = info.ratingsCount.toLocaleString();
    }

    // Cover image - upgrade to larger size by replacing zoom parameter
    const thumbnail = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? "";
    if (thumbnail) {
      // Replace zoom=1 with zoom=3 for larger image, and use https
      result.coverImageUrl = thumbnail
        .replace(/^http:/, "https:")
        .replace(/zoom=\d/, "zoom=3")
        .replace(/&edge=curl/, "");
    }

    // Publication info
    result.publishedDate = info.publishedDate ?? "";
    result.publisher = info.publisher ?? "";

    // ISBN-13 preferred
    const isbn13 = info.industryIdentifiers?.find((id) => id.type === "ISBN_13");
    const isbn10 = info.industryIdentifiers?.find((id) => id.type === "ISBN_10");
    result.isbn = isbn13?.identifier ?? isbn10?.identifier ?? "";

    // Construct Amazon search URL
    const amazonQuery = encodeURIComponent(`${bookTitle} ${authorName}`);
    result.amazonUrl = `https://www.amazon.com/s?k=${amazonQuery}&i=stripbooks`;

    // Goodreads search URL
    const goodreadsQuery = encodeURIComponent(`${bookTitle} ${authorName}`);
    result.goodreadsUrl = `https://www.goodreads.com/search?q=${goodreadsQuery}`;

    // Google Books info link as resource
    if (info.infoLink) {
      result.resourceUrl = info.infoLink;
      result.resourceLabel = "Google Books";
    }
  } catch (err) {
    console.error(`[bookEnrich] Failed to enrich "${bookTitle}":`, err);
  }

  // LLM fallback: if Google Books returned no summary, generate one with the selected model
  if (!result.summary) {
    console.log(`[bookEnrich] No Google Books summary for "${bookTitle}", using LLM fallback (model: ${model ?? "default"})`);
    result.summary = await generateBookSummaryWithLLM(bookTitle, authorName, model);
  }

  return result;
}

