/**
 * debug-rich-bio.ts — test enrichRichBio for specific authors
 */
import "dotenv/config";
import { invokeLLM } from "../server/_core/llm";

async function testAuthor(authorName: string) {
  console.log(`\n=== Testing: "${authorName}" ===`);
  const researchPrompt = `You are a professional biographer and researcher. Gather comprehensive factual information about ${authorName}.
Research and provide detailed information about:
1. Full career history
2. Educational background
3. Key achievements
4. Personal background
5. Current activities (or legacy if deceased)
6. Notable quotes or ideas they are known for
Be thorough and factual. Include dates and organizations wherever possible.`;

  const res = await invokeLLM({
    messages: [
      { role: "system", content: "You are a thorough research assistant with access to comprehensive knowledge about public figures, authors, and thought leaders. Provide detailed, factual information." },
      { role: "user", content: researchPrompt },
    ],
  });
  const content = res.choices?.[0]?.message?.content ?? "";
  const text = typeof content === "string" ? content : "";
  console.log(`Response length: ${text.length}`);
  console.log(`First 300 chars: ${text.slice(0, 300)}`);
}

async function main() {
  await testAuthor("Dale Carnegie");
  await testAuthor("Mark Manson");
  await testAuthor("Stephen R. Covey");  // test a known-working author
}

main().catch(console.error);
