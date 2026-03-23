/**
 * richSummary.ts
 * Double-pass LLM enrichment for book rich summary, key themes, similar books, and resource links.
 *
 * Pass 1 — Research pass:
 *   Gather raw facts: plot/content summary, key themes, reception, author context, related works.
 *
 * Pass 2 — Synthesis pass:
 *   Produce structured JSON with:
 *   - fullSummary: 3-4 paragraph rich summary
 *   - keyThemes: array of {theme, description}
 *   - keyQuotes: array of notable quotes from the book
 *   - similarBooks: array of {title, author, reason}
 *   - resourceLinks: array of {label, url, type}
 */

import { invokeLLM } from "../_core/llm";

export interface KeyTheme {
  theme: string;
  description: string;
}

export interface KeyQuote {
  quote: string;
  context?: string;
}

export interface SimilarBook {
  title: string;
  author: string;
  reason: string;
}

export interface ResourceLink {
  label: string;
  url: string;
  type: "summary" | "review" | "podcast" | "video" | "purchase" | "author" | "other";
}

export interface RichSummaryResult {
  fullSummary: string;
  keyThemes: KeyTheme[];
  keyQuotes: KeyQuote[];
  similarBooks: SimilarBook[];
  resourceLinks: ResourceLink[];
  enrichedAt: string;
  model: string;
}

/**
 * Perform a double-pass LLM enrichment for a book's rich summary.
 * Returns null if the book is unknown or enrichment fails.
 */
export async function enrichRichSummary(
  bookTitle: string,
  authorName: string,
  existingSummary?: string | null,
  category?: string | null
): Promise<RichSummaryResult | null> {
  try {
    // ── Pass 1: Research pass ─────────────────────────────────────────────────
    const researchPrompt = `You are a literary researcher and book critic. Gather comprehensive information about the book "${bookTitle}" by ${authorName}${category ? ` (${category})` : ""}.

Research and provide:
1. Detailed content summary: what the book covers, its main arguments or narrative arc
2. Key themes and ideas: the central concepts, frameworks, or lessons
3. Critical reception: how it was received, notable reviews, awards
4. Author's purpose: why they wrote it, what problem it solves or story it tells
5. Notable quotes: 2-4 memorable or representative quotes from the book
6. Similar books: 4-6 books that readers of this book would also enjoy, with specific reasons why
7. Key resources: where to find summaries, author interviews, podcast episodes about this book, purchase links

${existingSummary ? `Existing summary for context:\n${existingSummary}\n\nExpand significantly beyond this.` : ""}

Be thorough and specific. Include publication year if known.`;

    const researchResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a thorough literary researcher with comprehensive knowledge of books, authors, and publishing. Provide detailed, factual information about books.",
        },
        { role: "user", content: researchPrompt },
      ],
    });

    const rawResearchContent =
      researchResponse.choices?.[0]?.message?.content ?? "";
    const rawResearch =
      typeof rawResearchContent === "string" ? rawResearchContent : "";

    if (!rawResearch || rawResearch.length < 100) {
      return null;
    }

    // ── Pass 2: Synthesis pass ────────────────────────────────────────────────
    const synthesisPrompt = `Based on the following research about "${bookTitle}" by ${authorName}, create a structured book profile in JSON format.

Research data:
${rawResearch}

Return a JSON object with exactly this structure:
{
  "fullSummary": "3-4 paragraph rich summary. First paragraph: what the book is about and its central premise. Second paragraph: key arguments, frameworks, or narrative arc. Third paragraph: major insights and impact. Fourth paragraph (optional): why this book matters and who should read it.",
  "keyThemes": [
    {
      "theme": "Theme name (2-4 words)",
      "description": "1-2 sentence explanation of how this theme manifests in the book"
    }
  ],
  "keyQuotes": [
    {
      "quote": "The exact quote text",
      "context": "Optional: brief context about when/why this quote appears"
    }
  ],
  "similarBooks": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "1 sentence explaining why readers of this book would enjoy it"
    }
  ],
  "resourceLinks": [
    {
      "label": "Display label e.g. 'Goodreads', 'Amazon', 'Author Interview on Tim Ferriss'",
      "url": "https://...",
      "type": "summary|review|podcast|video|purchase|author|other"
    }
  ]
}

Rules:
- keyThemes: 3-6 themes
- keyQuotes: 2-4 quotes (only include if genuinely from the book)
- similarBooks: 4-6 books with specific, compelling reasons
- resourceLinks: include Goodreads, Amazon, and any notable podcast/interview URLs you know of
- fullSummary should be engaging and suitable for a library catalog
- Return ONLY valid JSON, no markdown fences`;

    const synthesisResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a professional book critic and literary editor who writes polished, accurate book profiles. You always return valid JSON.",
        },
        { role: "user", content: synthesisPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "rich_summary",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fullSummary: { type: "string" },
              keyThemes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    theme: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["theme", "description"],
                  additionalProperties: false,
                },
              },
              keyQuotes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    quote: { type: "string" },
                    context: { type: "string" },
                  },
                  required: ["quote", "context"],
                  additionalProperties: false,
                },
              },
              similarBooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    author: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["title", "author", "reason"],
                  additionalProperties: false,
                },
              },
              resourceLinks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    url: { type: "string" },
                    type: { type: "string" },
                  },
                  required: ["label", "url", "type"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "fullSummary",
              "keyThemes",
              "keyQuotes",
              "similarBooks",
              "resourceLinks",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent =
      synthesisResponse.choices?.[0]?.message?.content ?? "";
    const raw = typeof rawContent === "string" ? rawContent : "";
    let parsed: Omit<RichSummaryResult, "enrichedAt" | "model">;

    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        return null;
      }
    }

    return {
      fullSummary: parsed.fullSummary ?? "",
      keyThemes: parsed.keyThemes ?? [],
      keyQuotes: parsed.keyQuotes ?? [],
      similarBooks: parsed.similarBooks ?? [],
      resourceLinks: parsed.resourceLinks ?? [],
      enrichedAt: new Date().toISOString(),
      model: "double-pass-llm",
    };
  } catch (err) {
    console.error(`[richSummary] Error enriching "${bookTitle}":`, err);
    return null;
  }
}
