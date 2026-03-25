/**
 * Probe CNBC and Seeking Alpha RapidAPI endpoints to understand their response shapes.
 * Run: node scripts/probe-rapidapi.mjs
 */
const key = process.env.RAPIDAPI_KEY;
if (!key) {
  console.error("RAPIDAPI_KEY not set");
  process.exit(1);
}
console.log("Key present:", key.slice(0, 8) + "...");

async function probe(label, url, host) {
  console.log(`\n=== ${label} ===`);
  console.log("URL:", url);
  try {
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-host": host,
        "x-rapidapi-key": key,
      },
    });
    console.log("Status:", res.status);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log("Response (truncated):", JSON.stringify(json, null, 2).slice(0, 1500));
    } catch {
      console.log("Raw response (truncated):", text.slice(0, 500));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

// CNBC endpoints to probe
await probe(
  "CNBC - news list (franchise 10000664 = Business News)",
  "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10000664&count=5",
  "cnbc.p.rapidapi.com"
);

await probe(
  "CNBC - search for author 'Adam Grant'",
  "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10000664&count=20&tag=Adam+Grant",
  "cnbc.p.rapidapi.com"
);

// Seeking Alpha endpoints
await probe(
  "Seeking Alpha - news list",
  "https://seeking-alpha.p.rapidapi.com/news/v2/list?size=5&number=1",
  "seeking-alpha.p.rapidapi.com"
);

await probe(
  "Seeking Alpha - search articles",
  "https://seeking-alpha.p.rapidapi.com/articles/v2/list?size=5&number=1&category=market-news",
  "seeking-alpha.p.rapidapi.com"
);

await probe(
  "Seeking Alpha - author search",
  "https://seeking-alpha.p.rapidapi.com/screeners/v1/search?phrase=Adam+Grant&type=authors",
  "seeking-alpha.p.rapidapi.com"
);
