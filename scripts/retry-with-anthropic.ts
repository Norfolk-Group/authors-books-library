/**
 * retry-with-anthropic.ts
 *
 * Retries the 3 remaining failed enrichments using the Anthropic SDK directly,
 * bypassing the invokeLLM helper which is returning empty content for these items:
 *   Authors: Dale Carnegie, Mark Manson (richBioJson missing)
 *   Books: "The 7 Habits of Highly Effective People" (richSummaryJson missing)
 *
 * Usage:
 *   npx tsx scripts/retry-with-anthropic.ts
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { authorProfiles, bookProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichAuthorBioWithAnthropic(authorName: string, existingBio?: string | null) {
  console.log(`  [pass 1] Researching "${authorName}"...`);
  const researchMsg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: "You are a thorough research assistant with comprehensive knowledge about public figures, authors, and thought leaders. Provide detailed, factual information.",
    messages: [
      {
        role: "user",
        content: `Gather comprehensive factual information about ${authorName}.
Research and provide detailed information about:
1. Full career history: every significant role, position, company, organization (with approximate years)
2. Educational background: universities, degrees, notable programs
3. Key achievements: awards, bestselling books, notable projects, companies founded
4. Personal background: where they grew up, family context if publicly known, personal philosophy
5. Current activities (or legacy if deceased): what they are doing now or what they left behind
6. Notable quotes or ideas they are known for
${existingBio ? `Existing bio for context:\n${existingBio}\n\nExpand significantly beyond this.` : ""}
Be thorough and factual. Include dates and organizations wherever possible.`,
      },
    ],
  });

  const rawResearch = researchMsg.content[0].type === "text" ? researchMsg.content[0].text : "";
  if (!rawResearch || rawResearch.length < 100) {
    console.log(`  [pass 1] Empty response, aborting.`);
    return null;
  }
  console.log(`  [pass 1] Got ${rawResearch.length} chars. Running synthesis...`);

  await sleep(1500);

  const synthesisMsg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: "You are a professional biographer who writes polished, accurate author profiles for library and academic contexts. You always return valid JSON.",
    messages: [
      {
        role: "user",
        content: `Based on the following research about ${authorName}, create a structured, polished author profile in JSON format.

Research data:
${rawResearch}

Return a JSON object with exactly this structure:
{
  "fullBio": "3-5 paragraph professional and personal narrative biography.",
  "professionalSummary": "One concise paragraph (2-3 sentences) executive summary.",
  "personalNote": "One interesting personal anecdote or fun fact. Use empty string if nothing compelling is known.",
  "professionalEntries": [
    {
      "title": "Job title or role",
      "org": "Organization or company name",
      "period": "Year range e.g. 2010–2018 or 2015–present",
      "description": "1-2 sentence description of responsibilities and impact"
    }
  ]
}
Rules:
- professionalEntries should be in reverse chronological order (most recent first)
- Include 3-8 entries covering the most significant career milestones
- Return ONLY valid JSON, no markdown fences`,
      },
    ],
  });

  const raw = synthesisMsg.content[0].type === "text" ? synthesisMsg.content[0].text : "";
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      fullBio: parsed.fullBio ?? "",
      professionalSummary: parsed.professionalSummary ?? "",
      personalNote: parsed.personalNote ?? "",
      professionalEntries: parsed.professionalEntries ?? [],
      enrichedAt: new Date().toISOString(),
      model: "claude-opus-4-5",
    };
  } catch (err) {
    console.error(`  [pass 2] JSON parse error:`, err);
    console.error(`  [pass 2] Raw response (first 500):`, raw.slice(0, 500));
    return null;
  }
}

async function enrichBookSummaryWithAnthropic(bookTitle: string, authorName: string, existingSummary?: string | null) {
  console.log(`  [pass 1] Researching "${bookTitle}" by ${authorName}...`);
  const researchMsg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: "You are a literary researcher and book critic with comprehensive knowledge. Provide detailed, factual information.",
    messages: [
      {
        role: "user",
        content: `Gather comprehensive information about the book "${bookTitle}" by ${authorName}.

Research and provide:
1. Detailed content summary: what the book covers, its main arguments or narrative arc
2. Key themes and ideas: the central concepts, frameworks, or lessons
3. Critical reception: how it was received, notable reviews, awards
4. Author's purpose: why they wrote it, what problem it solves
5. Notable quotes: 2-4 memorable quotes from the book
6. Similar books: 4-6 books readers would also enjoy, with specific reasons why
7. Key resources: summaries, author interviews, podcast episodes about this book

${existingSummary ? `Existing summary for context:\n${existingSummary}\n\nExpand significantly beyond this.` : ""}`,
      },
    ],
  });

  const rawResearch = researchMsg.content[0].type === "text" ? researchMsg.content[0].text : "";
  if (!rawResearch || rawResearch.length < 100) {
    console.log(`  [pass 1] Empty response, aborting.`);
    return null;
  }
  console.log(`  [pass 1] Got ${rawResearch.length} chars. Running synthesis...`);

  await sleep(1500);

  const synthesisMsg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: "You are a professional literary critic who writes polished book profiles for library and academic contexts. You always return valid JSON.",
    messages: [
      {
        role: "user",
        content: `Based on the following research about "${bookTitle}" by ${authorName}, create a structured book profile in JSON format.

Research data:
${rawResearch}

Return a JSON object with exactly this structure:
{
  "fullSummary": "3-5 paragraph detailed summary of the book's content, arguments, and significance.",
  "executiveSummary": "One concise paragraph (2-3 sentences) suitable for a catalog or jacket copy.",
  "keyThemes": [{"theme": "Theme name", "description": "1-2 sentence description"}],
  "keyQuotes": [{"quote": "The quote text", "context": "Brief context for the quote"}],
  "similarBooks": [{"title": "Book title", "author": "Author name", "reason": "Why readers would enjoy it"}],
  "resourceLinks": [{"label": "Resource name", "url": "URL if known, else empty string", "type": "summary|interview|podcast|review"}]
}
Rules:
- keyThemes: 3-6 entries
- keyQuotes: 2-4 entries
- similarBooks: 4-6 entries
- resourceLinks: 2-5 entries
- Return ONLY valid JSON, no markdown fences`,
      },
    ],
  });

  const raw = synthesisMsg.content[0].type === "text" ? synthesisMsg.content[0].text : "";
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      fullSummary: parsed.fullSummary ?? "",
      executiveSummary: parsed.executiveSummary ?? "",
      keyThemes: parsed.keyThemes ?? [],
      keyQuotes: parsed.keyQuotes ?? [],
      similarBooks: parsed.similarBooks ?? [],
      resourceLinks: parsed.resourceLinks ?? [],
      enrichedAt: new Date().toISOString(),
      model: "claude-opus-4-5",
    };
  } catch (err) {
    console.error(`  [pass 2] JSON parse error:`, err);
    console.error(`  [pass 2] Raw response (first 500):`, raw.slice(0, 500));
    return null;
  }
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  // ── 1. Author bios ───────────────────────────────────────────────────────
  const failedAuthors = ["Dale Carnegie", "Mark Manson"];

  for (const authorName of failedAuthors) {
    console.log(`\n[retry-anthropic] Author bio: "${authorName}"`);
    const [author] = await db
      .select()
      .from(authorProfiles)
      .where(eq(authorProfiles.authorName, authorName))
      .limit(1);

    if (!author) {
      console.log(`  ✗ Author not found in DB`);
      continue;
    }

    const result = await enrichAuthorBioWithAnthropic(author.authorName, author.bio);
    if (result) {
      await db
        .update(authorProfiles)
        .set({ richBioJson: JSON.stringify(result), updatedAt: new Date() })
        .where(eq(authorProfiles.id, author.id));
      console.log(`  ✓ Rich bio saved`);
    } else {
      console.log(`  ✗ Failed`);
    }

    await sleep(2000);
  }

  // ── 2. Book summary ──────────────────────────────────────────────────────
  const failedBooks = ["The 7 Habits of Highly Effective People"];

  for (const bookTitle of failedBooks) {
    console.log(`\n[retry-anthropic] Book summary: "${bookTitle}"`);
    const [book] = await db
      .select()
      .from(bookProfiles)
      .where(eq(bookProfiles.bookTitle, bookTitle))
      .limit(1);

    if (!book) {
      console.log(`  ✗ Book not found in DB`);
      continue;
    }

    const result = await enrichBookSummaryWithAnthropic(book.bookTitle, book.authorName ?? "", book.summary);
    if (result) {
      await db
        .update(bookProfiles)
        .set({ richSummaryJson: JSON.stringify(result), updatedAt: new Date() })
        .where(eq(bookProfiles.id, book.id));
      console.log(`  ✓ Rich summary saved`);
    } else {
      console.log(`  ✗ Failed`);
    }

    await sleep(2000);
  }

  console.log("\n[retry-with-anthropic] Done.");
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
