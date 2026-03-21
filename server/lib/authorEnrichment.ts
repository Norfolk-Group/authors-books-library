/**
 * Author enrichment helpers: Wikipedia REST API + Wikidata + LLM fallback.
 *
 * Extracted from authorProfiles.router.ts to keep the router under 150 lines.
 * Used by:
 *   - authorProfiles.router.ts (enrich, enrichBatch procedures)
 *   - Any future enrichment jobs or scripts
 */
import { invokeLLM } from "../_core/llm";

// -- Types ---------------------------------------------------------------------

export interface AuthorInfo {
  bio: string;
  websiteUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
}

// -- LLM fallback bio ----------------------------------------------------------

/**
 * Generate a short author bio using the configured LLM when Wikipedia
 * returns no content. Caps the result at 400 characters.
 */
export async function generateBioWithLLM(authorName: string, model?: string): Promise<string> {
  try {
    const result = await invokeLLM({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a concise literary reference assistant. Write factual, professional author bios in 2-3 sentences. Focus on their main field, notable works, and impact. No fluff.",
        },
        {
          role: "user",
          content: `Write a 2-sentence professional bio for the author "${authorName}". Include their main field of expertise and 1-2 notable works if known. Keep it under 300 characters.`,
        },
      ],
    });
    const raw = result?.choices?.[0]?.message?.content ?? "";
    const content = typeof raw === "string" ? raw : "";
    return content.trim().slice(0, 400);
  } catch (err) {
    console.error(`[authorEnrich] LLM bio generation failed for "${authorName}":`, err);
    return "";
  }
}

// -- Wikipedia + Wikidata enrichment ------------------------------------------

/**
 * Fetch author bio from Wikipedia REST API and social/website links from Wikidata.
 *
 * Cascade:
 *   1. Wikipedia REST summary (direct slug)
 *   2. Wikipedia search API (if direct slug fails)
 *   3. Wikidata claims for P856 (website), P2002 (Twitter), P6634 (LinkedIn)
 *   4. LLM fallback if Wikipedia returns no bio
 *
 * @param authorName - Display name as it appears in the library
 * @param model - Optional Gemini model ID for the LLM fallback
 */
export async function enrichAuthorViaWikipedia(
  authorName: string,
  model?: string
): Promise<AuthorInfo> {
  const result: AuthorInfo = { bio: "", websiteUrl: "", twitterUrl: "", linkedinUrl: "" };

  try {
    // 1. Wikipedia summary (bio + wikibase_item for Wikidata lookup)
    const searchSlug = encodeURIComponent(authorName.replace(/ /g, "_"));
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${searchSlug}`;
    const wikiRes = await fetch(wikiUrl, {
      headers: { "User-Agent": "NCG-Library/1.0 (contact@norfolkconsulting.com)" },
    });

    let wikidataId: string | null = null;

    if (wikiRes.ok) {
      const wikiData = (await wikiRes.json()) as {
        extract?: string;
        wikibase_item?: string;
      };
      const extract = wikiData.extract ?? "";
      const sentences = extract.match(/[^.!?]+[.!?]+/g) ?? [];
      result.bio = sentences.slice(0, 2).join(" ").trim().slice(0, 400);
      wikidataId = wikiData.wikibase_item ?? null;
    } else {
      // 2. Search fallback
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(authorName)}&srlimit=1&format=json&origin=*`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "NCG-Library/1.0" },
      });
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          query?: { search?: Array<{ title: string }> };
        };
        const firstResult = searchData.query?.search?.[0];
        if (firstResult) {
          const altSlug = encodeURIComponent(firstResult.title.replace(/ /g, "_"));
          const altRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${altSlug}`,
            { headers: { "User-Agent": "NCG-Library/1.0" } }
          );
          if (altRes.ok) {
            const altData = (await altRes.json()) as {
              extract?: string;
              wikibase_item?: string;
            };
            const extract = altData.extract ?? "";
            const sentences = extract.match(/[^.!?]+[.!?]+/g) ?? [];
            result.bio = sentences.slice(0, 2).join(" ").trim().slice(0, 400);
            wikidataId = altData.wikibase_item ?? null;
          }
        }
      }
    }

    // 3. Wikidata for website + Twitter + LinkedIn
    if (wikidataId) {
      const wdUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json&origin=*`;
      const wdRes = await fetch(wdUrl, {
        headers: { "User-Agent": "NCG-Library/1.0" },
      });
      if (wdRes.ok) {
        const wdData = (await wdRes.json()) as {
          entities?: Record<
            string,
            {
              claims?: Record<
                string,
                Array<{ mainsnak?: { datavalue?: { value?: string } } }>
              >;
            }
          >;
        };
        const entity = wdData.entities?.[wikidataId];
        const claims = entity?.claims ?? {};

        const website = claims["P856"]?.[0]?.mainsnak?.datavalue?.value ?? "";
        if (website) result.websiteUrl = website;

        const twitterHandle = claims["P2002"]?.[0]?.mainsnak?.datavalue?.value ?? "";
        if (twitterHandle) result.twitterUrl = `https://twitter.com/${twitterHandle}`;

        const linkedinId = claims["P6634"]?.[0]?.mainsnak?.datavalue?.value ?? "";
        if (linkedinId) result.linkedinUrl = `https://www.linkedin.com/in/${linkedinId}`;
      }
    }
  } catch (err) {
    console.error(`[authorEnrich] Failed to enrich "${authorName}":`, err);
  }

  // 4. LLM fallback if Wikipedia returned no bio
  if (!result.bio) {
    console.log(
      `[authorEnrich] No Wikipedia bio for "${authorName}", using LLM fallback (model: ${model ?? "default"})`
    );
    result.bio = await generateBioWithLLM(authorName, model);
  }

  return result;
}
