/**
 * Session A — Step 3: Auto-tag untagged authors
 * Uses LLM to assign taxonomy tags to authors that have no tags yet.
 * Based on author name + book titles (even without a bio).
 */
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const { getDb } = await import("../server/db.js");
const { invokeLLM } = await import("../server/_core/llm.js");
const { authorProfiles, bookProfiles, tags } = await import("../drizzle/schema.js");
const { eq, isNull, or } = await import("drizzle-orm");

const TAG_TAXONOMY = [
  "business", "psychology", "science", "leadership", "economics",
  "philosophy", "history", "technology", "self-help", "neuroscience",
  "communication", "creativity", "health", "sociology", "politics",
  "spirituality", "marketing", "finance", "education", "journalism",
];

const db = await getDb();
if (!db) { console.error("❌ DB unavailable"); process.exit(1); }

// Fetch untagged authors
const allAuthors = await db
  .select({ authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson, tagsJson: authorProfiles.tagsJson })
  .from(authorProfiles);

const untagged = allAuthors.filter(a => !a.tagsJson || a.tagsJson === "[]" || a.tagsJson === "null" || a.tagsJson === "");

console.log(`\n🏷️  Auto-tagging ${untagged.length} untagged authors\n`);

for (const author of untagged) {
  // Fetch books
  const books = await db
    .select({ bookTitle: bookProfiles.bookTitle, summary: bookProfiles.summary })
    .from(bookProfiles)
    .where(eq(bookProfiles.authorName, author.authorName));

  const bookList = books.map(b => `"${b.bookTitle}"`).join(", ");
  const bio = author.bio ?? "";
  const richBio = author.richBioJson ? (() => { try { return JSON.parse(author.richBioJson!); } catch { return null; } })() : null;
  const fullBio = richBio?.fullBio ?? bio;

  const prompt = `Author: ${author.authorName}
Books: ${bookList || "No books found"}
Bio: ${fullBio.substring(0, 500) || "No bio available"}

Available taxonomy tags: ${TAG_TAXONOMY.join(", ")}

Based on the author's name, books, and bio, select the 2-4 most relevant tags from the taxonomy.
Return ONLY a JSON array of tag slugs, e.g.: ["business", "leadership"]
Do not include any other text.`;

  try {
    const resp = await invokeLLM({
      messages: [
        { role: "system", content: "You are a librarian assigning taxonomy tags to authors. Return only a JSON array of tag slugs." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: "tags", strict: true, schema: { type: "object", properties: { tags: { type: "array", items: { type: "string" } } }, required: ["tags"], additionalProperties: false } } },
    });

    const content = resp.choices[0]?.message?.content ?? "{}";
    let parsed: string[] = [];
    try {
      const obj = JSON.parse(content);
      parsed = Array.isArray(obj) ? obj : (obj.tags ?? []);
    } catch {
      // Try to extract array from content
      const match = content.match(/\[.*?\]/s);
      if (match) parsed = JSON.parse(match[0]);
    }

    const validSlugs = parsed.filter((s: string) => TAG_TAXONOMY.includes(s));
    if (validSlugs.length === 0) {
      console.log(`  ⚠️  ${author.authorName}: no valid tags returned (got: ${content})`);
      continue;
    }

    const tagsJson = JSON.stringify(validSlugs);
    await db.update(authorProfiles).set({ tagsJson, updatedAt: new Date() }).where(eq(authorProfiles.authorName, author.authorName));
    console.log(`  ✓ ${author.authorName}: [${validSlugs.join(", ")}]`);
  } catch (err) {
    console.error(`  ✗ ${author.authorName}: ${String(err)}`);
  }
}

// Final count
const allAfter = await db.select({ tagsJson: authorProfiles.tagsJson }).from(authorProfiles);
const taggedCount = allAfter.filter(a => a.tagsJson && a.tagsJson !== "[]" && a.tagsJson !== "null" && a.tagsJson !== "").length;
const total = allAfter.length;
console.log(`\n✅ Tagging complete: ${taggedCount}/${total} (${Math.round(taggedCount/total*100)}%) authors tagged`);

process.exit(0);
