/**
 * Probe CNBC auto-complete and list-by-symbol for author lookup strategy.
 * Run: node scripts/probe-cnbc3.mjs
 */
const key = process.env.RAPIDAPI_KEY;
if (!key) { console.error("RAPIDAPI_KEY not set"); process.exit(1); }
const HOST = "cnbc.p.rapidapi.com";
const headers = { "x-rapidapi-host": HOST, "x-rapidapi-key": key };

async function probe(label, url) {
  console.log(`\n=== ${label} ===`);
  try {
    const res = await fetch(url, { headers });
    console.log("Status:", res.status);
    const text = await res.text();
    try { console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 2500)); }
    catch { console.log(text.slice(0, 500)); }
  } catch (e) { console.error("Error:", e.message); }
  await new Promise(r => setTimeout(r, 1200));
}

// Test auto-complete with author names
await probe("v2/auto-complete: Adam Grant", "https://cnbc.p.rapidapi.com/v2/auto-complete?q=Adam+Grant");
await probe("v2/auto-complete: Malcolm Gladwell", "https://cnbc.p.rapidapi.com/v2/auto-complete?q=Malcolm+Gladwell");
await probe("v2/auto-complete: Simon Sinek", "https://cnbc.p.rapidapi.com/v2/auto-complete?q=Simon+Sinek");

// Test news/v2/list-by-symbol with a person symbol if found
await probe("news/v2/list-by-symbol: TSLA (test)", "https://cnbc.p.rapidapi.com/news/v2/list-by-symbol?page=1&pageSize=5&symbol=TSLA");

// Test multiple franchise IDs to find business/leadership content
// 10001147 = Make It, 10000108 = Business, 10000113 = Investing
// Try franchise IDs for leadership/management content
await probe("news/v2/list franchise 10001147 (Make It)", "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10001147&count=5");
await probe("news/v2/list franchise 10000108 (Business)", "https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10000108&count=5");
