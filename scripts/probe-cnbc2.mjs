/**
 * Probe CNBC RapidAPI endpoints - round 2: find search/author endpoints.
 * Run: node scripts/probe-cnbc2.mjs
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
  await new Promise(r => setTimeout(r, 1200));
}

// Try different franchise IDs for business/finance content
await probe("CNBC - franchise 10001147 (Make It)", "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10001147&count=3");
await probe("CNBC - franchise 10000108 (Business)", "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10000108&count=3");
await probe("CNBC - franchise 10000113 (Investing)", "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10000113&count=3");

// Try the search endpoint with different paths
await probe("CNBC - search v1", "https://cnbc.p.rapidapi.com/news/v1/list-by-search?q=Adam+Grant&count=5");
await probe("CNBC - search (top-level)", "https://cnbc.p.rapidapi.com/search?q=Adam+Grant&count=5");
await probe("CNBC - get-news-list", "https://cnbc.p.rapidapi.com/get-news-list?franchiseId=10000664&count=3");

// Try tag-based filtering with relatedTagsFilteredFormatted
await probe("CNBC - list by section 'leadership'", "https://cnbc.p.rapidapi.com/news/v2/list?section=leadership&count=5");
await probe("CNBC - list by section 'work'", "https://cnbc.p.rapidapi.com/news/v2/list?section=work&count=5");
