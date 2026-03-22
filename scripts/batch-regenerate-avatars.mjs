/**
 * Batch Avatar Regeneration Script
 * Upgrades all non-meticulous authors to the Tier 5 meticulous pipeline.
 * 
 * Usage: node scripts/batch-regenerate-avatars.mjs
 * 
 * Runs serially (1 at a time) to avoid Gemini API rate limits.
 * Estimated time: ~35s per author × 173 authors ≈ 100 minutes.
 * 
 * Progress is logged to stdout and to /tmp/batch-regen-progress.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const BASE_URL = "http://localhost:3000";
const PROGRESS_FILE = "/tmp/batch-regen-progress.json";
const DELAY_BETWEEN_AUTHORS_MS = 2000; // 2s cooldown between authors

// Load progress from previous run (for resumability)
let progress = { completed: [], failed: [], startedAt: new Date().toISOString() };
if (existsSync(PROGRESS_FILE)) {
  try {
    progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    console.log(`Resuming from previous run: ${progress.completed.length} completed, ${progress.failed.length} failed`);
  } catch {
    console.log("Starting fresh (could not parse progress file)");
  }
}

const completedSet = new Set(progress.completed);

async function getAuthorsToProcess() {
  const res = await fetch(`${BASE_URL}/api/trpc/authorProfiles.getAvatarMap`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  // Use direct DB query via the admin endpoint instead
  const dbRes = await fetch(`${BASE_URL}/api/trpc/admin.getAuthorsNeedingRegen`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  // Fall back to hardcoded list from DB query
  return null;
}

// Hardcoded list from DB query (avatarSource != 'google-imagen' OR avatarSource IS NULL)
const AUTHORS_TO_REGENERATE = [
  "Aaron Ross", "Al Ries", "Alan Dib", "Albert Rutherford", "Alex Hormozi",
  "Alison Wood Brooks", "Andrew Ross Sorkin", "Anne Morriss", "Annie Duke",
  "April Dunford", "Arianna Huffington", "Ash Maurya", "Ashvin Vaidyanathan",
  "Ben Horowitz", "Benjamin Franklin", "Bill Carr", "Bo Burlingham", "Brad Stone",
  "Brent Adamson", "Brian Tracy", "Brene Brown", "Bryan Stevenson", "Cal Newport",
  "Charles Duhigg", "Chris Anderson", "Chris Voss", "Chip Heath", "Clayton Christensen",
  "Cleo Wade", "Clifton Strengths", "Colin Bryar", "Dale Carnegie", "Dan Ariely",
  "Daniel H. Pink", "Daniel Kahneman", "David Epstein", "David Goggins",
  "David Maister", "David Meerman Scott", "David Ogilvy", "David Rock",
  "Derek Sivers", "Donald Miller", "Dorie Clark", "Doug Lemov", "Ed Catmull",
  "Eric Ries", "Eric Schmidt", "Ethan Mollick", "Frances Frei", "Frank Slootman",
  "Fred Reichheld", "Gad Saad", "Gary Vaynerchuk", "Geoffrey Moore", "George Orwell",
  "Hans Peter Bech", "Howard Schultz", "Jack Stack", "James Clear", "Jason Lemkin",
  "Jeff Bezos", "Jeff Walker", "Jill Konrath", "Jim Camp", "Jim Collins",
  "Jim Kwik", "John Doerr", "John Medina", "Jordan Belfort", "Joseph Grenny",
  "Justin Michael", "Kara Goldin", "Kelly Leonard", "Ken Blanchard", "Kim Scott",
  "Liz Wiseman", "Marcus Buckingham", "Mark Manson", "Mark Roberge",
  "Marshall Goldsmith", "Matthew Dixon", "Michael Bungay Stanier", "Michael Gerber",
  "Michael Lewis", "Michael Watkins", "Mike Weinberg", "Morgan Housel",
  "Napoleon Hill", "Neil Rackham", "Nicholas Carr", "Nicholas Nassim Taleb",
  "Nir Eyal", "Noah Kagan", "Ori Brafman", "Patrick Lencioni", "Paul Graham",
  "Peter Drucker", "Peter Thiel", "Phil Barden", "Philip Kotler", "Pia Silva",
  "Ray Dalio", "Reid Hoffman", "Richard H. Thaler", "Robert B. Cialdini",
  "Robert Greene", "Robert Kiyosaki", "Roger Fisher", "Ron Friedman",
  "Ruben Rabago", "Ryan Holiday", "Sam Walton", "Scott Galloway", "Seth Godin",
  "Shane Parrish", "Simon Sinek", "Spencer Johnson", "Stephen Covey",
  "Stephen Hawking", "Steve Blank", "Steve Martin", "Steven Kotler",
  "Steven Levitt", "Stuart Diamond", "Sun Tzu", "Tali Sharot", "Tiffani Bova",
  "Tim Ferriss", "Todd Herman", "Tom Peters", "Tony Robbins", "Traction Book",
  "Vanessa Van Edwards", "W. Chan Kim", "Walter Isaacson", "Warren Buffett",
  "Will Larson", "William Ury", "Yuval Noah Harari",
];

async function regenerateAvatar(authorName) {
  const body = {
    json: {
      authorName,
      forceRegenerate: true,
      avatarGenVendor: "google",
      avatarGenModel: "nano-banana",
      avatarResearchVendor: "google",
      avatarResearchModel: "gemini-2.5-flash",
    }
  };

  const res = await fetch(`${BASE_URL}/api/trpc/authorProfiles.generateAvatar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000), // 5 min timeout
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? JSON.stringify(data.error));
  }
  return data.result?.data?.json ?? data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  const toProcess = AUTHORS_TO_REGENERATE.filter(name => !completedSet.has(name));
  const total = AUTHORS_TO_REGENERATE.length;
  
  console.log(`\n=== Batch Avatar Regeneration ===`);
  console.log(`Total authors: ${total}`);
  console.log(`Already completed: ${progress.completed.length}`);
  console.log(`To process: ${toProcess.length}`);
  console.log(`Estimated time: ~${Math.ceil(toProcess.length * 37 / 60)} minutes\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const authorName = toProcess[i];
    const overallIdx = progress.completed.length + i + 1;
    
    process.stdout.write(`[${overallIdx}/${total}] ${authorName}... `);
    
    const startMs = Date.now();
    try {
      const result = await regenerateAvatar(authorName);
      const durationS = ((Date.now() - startMs) / 1000).toFixed(1);
      const source = result?.source ?? "unknown";
      const tier = result?.tier ?? "?";
      
      console.log(`✓ ${source} (tier ${tier}) in ${durationS}s`);
      progress.completed.push(authorName);
      successCount++;
    } catch (err) {
      const durationS = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`✗ FAILED in ${durationS}s: ${err.message?.slice(0, 100)}`);
      progress.failed.push({ name: authorName, error: err.message });
      failCount++;
    }

    // Save progress after each author
    saveProgress();

    // Cooldown between authors (except last)
    if (i < toProcess.length - 1) {
      await sleep(DELAY_BETWEEN_AUTHORS_MS);
    }
  }

  console.log(`\n=== Batch Complete ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total completed: ${progress.completed.length}/${total}`);
  
  if (progress.failed.length > 0) {
    console.log(`\nFailed authors:`);
    progress.failed.forEach(f => console.log(`  - ${f.name}: ${f.error?.slice(0, 80)}`));
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
