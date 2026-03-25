/**
 * Probe CNBC RapidAPI endpoints to discover response shapes.
 * Run: node scripts/probe-cnbc.mjs
 */
const key = process.env.RAPIDAPI_KEY;
if (!key) { console.error("RAPIDAPI_KEY not set"); process.exit(1); }
console.log("Key:", key.slice(0, 8) + "...\n");

const HOST = "cnbc.p.rapidapi.com";
const headers = { "x-rapidapi-host": HOST, "x-rapidapi-key": key };

async function probe(label, url) {
  console.log(`\n=== ${label} ===`);
  console.log("URL:", url);
  try {
    const res = await fetch(url, { headers });
    console.log("Status:", res.status);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2).slice(0, 2000));
    } catch {
      console.log(text.slice(0, 500));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 1200));
}

// 1. List available news categories / franchises
await probe("CNBC - news list default", "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10000664&count=3");

// 2. Search endpoint
await probe("CNBC - search Adam Grant", "https://cnbc.p.rapidapi.com/news/v2/list-by-search?q=Adam+Grant&count=5");

// 3. Alternative search
await probe("CNBC - auto-complete search", "https://cnbc.p.rapidapi.com/auto-complete/v2/search?q=Adam+Grant");

// 4. Get news by tag
await probe("CNBC - news by tag", "https://cnbc.p.rapidapi.com/news/v2/list?tag=Adam+Grant&count=5");

// 5. Get author profile
await probe("CNBC - author profile", "https://cnbc.p.rapidapi.com/news/v2/list?authorId=1&count=3");

// 6. Get all franchises
await probe("CNBC - list franchises", "https://cnbc.p.rapidapi.com/news/v2/list-franchises");

// 7. Get trending
await probe("CNBC - trending", "https://cnbc.p.rapidapi.com/news/v2/list-trending?count=3");
