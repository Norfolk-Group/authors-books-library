/**
 * contextualIntelligence.ts
 *
 * Aggressive multi-source biographical research pipeline for the "Digital Me" feature.
 * Goes far beyond a standard bio to capture the full contextual portrait of an author:
 *   - Geography: birthplace, formative cities, cultural regions
 *   - Historical era: world events during formative years, cultural context
 *   - Family & upbringing: parents, siblings, spouse, children, family culture
 *   - Associations & networks: mentors, collaborators, organizations, intellectual lineage
 *   - Formative experiences: pivotal moments, traumas, epiphanies
 *
 * Sources (waterfall, in order of reliability):
 *   1. Wikipedia REST API
 *   2. Wikidata SPARQL (structured claims)
 *   3. Perplexity API (web-grounded narrative)
 *   4. Tavily Search API (recent interviews/profiles)
 *   5. Google Knowledge Graph
 *   6. Amazon Author Page (Apify scrape)
 *   7. LinkedIn (Apify scrape)
 *   8. LLM Synthesis (Gemini/Claude — reconcile + fill gaps)
 *
 * All raw source responses are stored in authorBioSourcesJson for auditability.
 */

import { invokeLLM } from "../_core/llm";
import { logger } from "../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeographyData {
  birthCity?: string;
  birthCountry?: string;
  childhoodCity?: string;
  formativeCities?: string[];
  currentBase?: string;
  countriesLived?: string[];
  culturalRegions?: string[];
  geographyNarrative?: string;
}

export interface HistoricalContextData {
  birthDecade?: string;
  birthYear?: number;
  formativeYears?: { from: number; to: number };
  majorWorldEvents?: Array<{ year: number; event: string; relevance: string }>;
  culturalEra?: string;
  eraNarrative?: string;
}

export interface FamilyData {
  parents?: Array<{ name?: string; profession?: string; nationality?: string; notes?: string }>;
  siblings?: { count?: number; birthOrder?: string; notes?: string };
  spouse?: { name?: string; profession?: string; duration?: string; notes?: string };
  children?: { count?: number; notes?: string };
  familyCulture?: {
    religion?: string;
    politicalLeanings?: string;
    socioeconomicClass?: string;
    immigrationBackground?: string;
    notes?: string;
  };
}

export interface AssociationsData {
  mentors?: Array<{ name: string; relationship?: string; contribution?: string }>;
  proteges?: Array<{ name: string; notes?: string }>;
  collaborators?: Array<{ name: string; type?: string; notes?: string }>;
  intellectualRivals?: Array<{ name: string; disagreement?: string }>;
  organizations?: Array<{ name: string; role?: string; type?: string; url?: string }>;
  universities?: Array<{ name: string; degree?: string; year?: string; role?: string }>;
  schoolsOfThought?: string[];
  citedInfluences?: Array<{ name: string; type?: string; notes?: string }>;
  intellectualDescendants?: Array<{ name: string; notes?: string }>;
  signatureFrameworks?: Array<{ name: string; description?: string; year?: number }>;
}

export interface FormativeExperience {
  type: "trauma" | "epiphany" | "career" | "travel" | "loss" | "other";
  description: string;
  approximateYear?: number;
  source?: string;
}

export interface ContextualIntelligenceResult {
  geography: GeographyData;
  historicalContext: HistoricalContextData;
  family: FamilyData;
  associations: AssociationsData;
  formativeExperiences: FormativeExperience[];
  bioCompleteness: number;
  rawSources: Record<string, unknown>;
  enrichedAt: string;
}

// ── Wikipedia Wikidata SPARQL ─────────────────────────────────────────────────

async function fetchWikidataContextual(authorName: string): Promise<Record<string, unknown>> {
  try {
    // Search for the entity first
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(authorName)}&language=en&type=item&format=json&limit=1`;
    const searchResp = await fetch(searchUrl, {
      headers: { "User-Agent": "NCGLibrary/1.0 (contact@norfolkai.com)" },
    });
    if (!searchResp.ok) return {};
    const searchData = await searchResp.json() as { search?: Array<{ id: string }> };
    const entityId = searchData.search?.[0]?.id;
    if (!entityId) return {};

    // Fetch key claims
    const claimsUrl = `https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`;
    const claimsResp = await fetch(claimsUrl, {
      headers: { "User-Agent": "NCGLibrary/1.0 (contact@norfolkai.com)" },
    });
    if (!claimsResp.ok) return {};
    const claimsData = await claimsResp.json() as { entities?: Record<string, { claims?: Record<string, unknown[]> }> };
    const entity = claimsData.entities?.[entityId];
    if (!entity?.claims) return {};

    const claims = entity.claims;

    // Extract key properties
    const extract = (prop: string) => {
      const arr = claims[prop];
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const val = (arr[0] as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue?.value;
      return val;
    };

    const birthPlace = extract("P19");
    const deathPlace = extract("P20");
    const residences = claims["P551"] ?? [];
    const spouses = claims["P26"] ?? [];
    const children = claims["P40"] ?? [];
    const education = claims["P69"] ?? [];
    const employers = claims["P108"] ?? [];
    const birthDate = extract("P569");
    const memberOf = claims["P463"] ?? [];

    return {
      entityId,
      birthPlace,
      deathPlace,
      residences: residences.slice(0, 5),
      spouses: spouses.slice(0, 3),
      children: children.length,
      education: education.slice(0, 5),
      employers: employers.slice(0, 5),
      birthDate,
      memberOf: memberOf.slice(0, 10),
    };
  } catch (err) {
    logger.warn(`[contextualIntel] Wikidata fetch failed for "${authorName}":`, err);
    return {};
  }
}

// ── Perplexity Deep Research ──────────────────────────────────────────────────

async function fetchPerplexityContextual(authorName: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "";

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a professional biographer conducting deep research. Provide comprehensive, factual information. 
Always cite sources when possible. Focus on publicly available information only.`,
          },
          {
            role: "user",
            content: `Conduct deep biographical research on ${authorName}. I need comprehensive information across ALL of these dimensions:

**GEOGRAPHY & PLACE:**
- Exact birthplace (city, country, neighborhood if known)
- Where they grew up and spent formative years (ages 5–25)
- Cities they have lived in throughout their life
- Current base of operations
- Countries they have lived in or that significantly influenced them
- How their geographic background shaped their worldview and writing

**HISTORICAL & ERA CONTEXT:**
- Birth year and decade
- Major world events that occurred during their formative years (ages 10–25)
- Cultural movements, economic conditions, political climate of their youth
- How historical events shaped their perspective and work

**FAMILY & UPBRINGING:**
- Parents: names, professions, socioeconomic background, nationality, immigration history
- Siblings: number, birth order, any notable relationships
- Spouse/partner: name, profession, how long together
- Children: number, approximate ages
- Family religion, political leanings, cultural traditions
- Socioeconomic class growing up

**ASSOCIATIONS & NETWORKS:**
- Key mentors and who mentored them
- Notable proteges or people they have mentored
- Frequent collaborators (co-authors, business partners, co-presenters)
- Intellectual rivals or people they publicly disagree with
- Organizations: YPO, WEF, TED, Aspen Ideas, think tanks, boards, advisory roles
- Universities attended (degrees, years) and faculty positions
- Secret societies, honor societies, professional associations
- Schools of thought they belong to (behavioral economics, stoicism, positive psychology, etc.)

**INTELLECTUAL LINEAGE:**
- Authors and thinkers they cite most frequently
- Academic advisors (PhD/postdoc supervisors)
- Who has most influenced their thinking
- Who they have most influenced
- Named frameworks or models they created

**FORMATIVE EXPERIENCES:**
- Known pivotal moments: career near-misses, transformative experiences, personal losses
- Traumas or challenges they have publicly discussed
- Epiphanies or turning points they describe in their books or interviews

Be as specific and detailed as possible. Include dates, names, and sources.`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) return "";
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    logger.warn(`[contextualIntel] Perplexity fetch failed for "${authorName}":`, err);
    return "";
  }
}

// ── Tavily Recent Profiles ────────────────────────────────────────────────────

async function fetchTavilyContextual(authorName: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${authorName} biography family background upbringing childhood education mentors influences`,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5,
      }),
    });

    if (!response.ok) return "";
    const data = await response.json() as { answer?: string; results?: Array<{ content?: string }> };
    const answer = data.answer ?? "";
    const snippets = (data.results ?? []).map((r) => r.content ?? "").join("\n\n");
    return `${answer}\n\n${snippets}`.trim();
  } catch (err) {
    logger.warn(`[contextualIntel] Tavily fetch failed for "${authorName}":`, err);
    return "";
  }
}

// ── LLM Synthesis ─────────────────────────────────────────────────────────────

async function synthesizeContextualIntelligence(
  authorName: string,
  wikidataRaw: Record<string, unknown>,
  perplexityRaw: string,
  tavilyRaw: string,
  model?: string
): Promise<ContextualIntelligenceResult> {
  const sourceSummary = [
    wikidataRaw && Object.keys(wikidataRaw).length > 0
      ? `WIKIDATA STRUCTURED DATA:\n${JSON.stringify(wikidataRaw, null, 2)}`
      : "",
    perplexityRaw ? `PERPLEXITY RESEARCH:\n${perplexityRaw}` : "",
    tavilyRaw ? `TAVILY SEARCH:\n${tavilyRaw}` : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const prompt = `You are a senior biographer synthesizing research about ${authorName}.

Based on the following research data, extract and structure ALL available information into the JSON format specified below.
Be thorough — include everything you can find. If information is uncertain, include it with a note about confidence.
If a field has no data, use null or empty array.

RESEARCH DATA:
${sourceSummary || "No external data available — use your knowledge of this author."}

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "geography": {
    "birthCity": string | null,
    "birthCountry": string | null,
    "childhoodCity": string | null,
    "formativeCities": string[],
    "currentBase": string | null,
    "countriesLived": string[],
    "culturalRegions": string[],
    "geographyNarrative": string
  },
  "historicalContext": {
    "birthDecade": string | null,
    "birthYear": number | null,
    "formativeYears": { "from": number, "to": number } | null,
    "majorWorldEvents": [{ "year": number, "event": string, "relevance": string }],
    "culturalEra": string | null,
    "eraNarrative": string
  },
  "family": {
    "parents": [{ "name": string | null, "profession": string | null, "nationality": string | null, "notes": string | null }],
    "siblings": { "count": number | null, "birthOrder": string | null, "notes": string | null },
    "spouse": { "name": string | null, "profession": string | null, "duration": string | null, "notes": string | null },
    "children": { "count": number | null, "notes": string | null },
    "familyCulture": {
      "religion": string | null,
      "politicalLeanings": string | null,
      "socioeconomicClass": string | null,
      "immigrationBackground": string | null,
      "notes": string | null
    }
  },
  "associations": {
    "mentors": [{ "name": string, "relationship": string | null, "contribution": string | null }],
    "proteges": [{ "name": string, "notes": string | null }],
    "collaborators": [{ "name": string, "type": string | null, "notes": string | null }],
    "intellectualRivals": [{ "name": string, "disagreement": string | null }],
    "organizations": [{ "name": string, "role": string | null, "type": string | null, "url": string | null }],
    "universities": [{ "name": string, "degree": string | null, "year": string | null, "role": string | null }],
    "schoolsOfThought": string[],
    "citedInfluences": [{ "name": string, "type": string | null, "notes": string | null }],
    "intellectualDescendants": [{ "name": string, "notes": string | null }],
    "signatureFrameworks": [{ "name": string, "description": string | null, "year": number | null }]
  },
  "formativeExperiences": [
    { "type": "trauma"|"epiphany"|"career"|"travel"|"loss"|"other", "description": string, "approximateYear": number | null, "source": string | null }
  ]
}`;

  try {
    const response = await invokeLLM({
      model,
      messages: [
        { role: "system", content: "You are a precise biographical data extractor. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response?.choices?.[0]?.message?.content ?? "{}";
    const content = typeof raw === "string" ? raw : "{}";
    const parsed = JSON.parse(content) as Partial<ContextualIntelligenceResult>;

    // Compute bio completeness score
    const completeness = computeBioCompleteness(parsed);

    return {
      geography: parsed.geography ?? {},
      historicalContext: parsed.historicalContext ?? {},
      family: parsed.family ?? {},
      associations: parsed.associations ?? {},
      formativeExperiences: parsed.formativeExperiences ?? [],
      bioCompleteness: completeness,
      rawSources: {
        wikidata: wikidataRaw,
        perplexity: perplexityRaw ? perplexityRaw.slice(0, 2000) : null,
        tavily: tavilyRaw ? tavilyRaw.slice(0, 1000) : null,
      },
      enrichedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`[contextualIntel] LLM synthesis failed for "${authorName}":`, err);
    return {
      geography: {},
      historicalContext: {},
      family: {},
      associations: {},
      formativeExperiences: [],
      bioCompleteness: 0,
      rawSources: { error: String(err) },
      enrichedAt: new Date().toISOString(),
    };
  }
}

// ── Bio Completeness Scoring ──────────────────────────────────────────────────

function computeBioCompleteness(data: Partial<ContextualIntelligenceResult>): number {
  let score = 0;
  const max = 100;

  // Geography (20 points)
  const geo = data.geography ?? {};
  if (geo.birthCity) score += 5;
  if (geo.birthCountry) score += 3;
  if (geo.currentBase) score += 3;
  if ((geo.formativeCities?.length ?? 0) > 0) score += 4;
  if (geo.geographyNarrative && geo.geographyNarrative.length > 50) score += 5;

  // Historical context (15 points)
  const hist = data.historicalContext ?? {};
  if (hist.birthYear) score += 5;
  if ((hist.majorWorldEvents?.length ?? 0) > 0) score += 5;
  if (hist.eraNarrative && hist.eraNarrative.length > 50) score += 5;

  // Family (25 points)
  const fam = data.family ?? {};
  if ((fam.parents?.length ?? 0) > 0) score += 8;
  if (fam.spouse?.name) score += 5;
  if (fam.children?.count !== undefined && fam.children.count !== null) score += 4;
  if (fam.familyCulture?.socioeconomicClass) score += 4;
  if (fam.familyCulture?.religion || fam.familyCulture?.notes) score += 4;

  // Associations (25 points)
  const assoc = data.associations ?? {};
  if ((assoc.mentors?.length ?? 0) > 0) score += 6;
  if ((assoc.universities?.length ?? 0) > 0) score += 5;
  if ((assoc.organizations?.length ?? 0) > 0) score += 5;
  if ((assoc.citedInfluences?.length ?? 0) > 0) score += 5;
  if ((assoc.signatureFrameworks?.length ?? 0) > 0) score += 4;

  // Formative experiences (15 points)
  const exp = data.formativeExperiences ?? [];
  if (exp.length >= 1) score += 5;
  if (exp.length >= 3) score += 5;
  if (exp.length >= 5) score += 5;

  return Math.min(score, max);
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Run the full contextual intelligence pipeline for an author.
 * Executes all sources in parallel (where safe), then synthesizes with LLM.
 */
export async function enrichContextualIntelligence(
  authorName: string,
  model?: string
): Promise<ContextualIntelligenceResult> {
  logger.info(`[contextualIntel] Starting contextual intelligence enrichment for "${authorName}"`);

  // Run all sources in parallel
  const [wikidataRaw, perplexityRaw, tavilyRaw] = await Promise.allSettled([
    fetchWikidataContextual(authorName),
    fetchPerplexityContextual(authorName),
    fetchTavilyContextual(authorName),
  ]);

  const wikidata = wikidataRaw.status === "fulfilled" ? wikidataRaw.value : {};
  const perplexity = perplexityRaw.status === "fulfilled" ? perplexityRaw.value : "";
  const tavily = tavilyRaw.status === "fulfilled" ? tavilyRaw.value : "";

  logger.info(
    `[contextualIntel] Sources collected for "${authorName}": ` +
    `wikidata=${Object.keys(wikidata).length} keys, ` +
    `perplexity=${perplexity.length} chars, ` +
    `tavily=${tavily.length} chars`
  );

  // Synthesize with LLM
  const result = await synthesizeContextualIntelligence(
    authorName,
    wikidata,
    perplexity,
    tavily,
    model
  );

  logger.info(
    `[contextualIntel] Completed for "${authorName}": ` +
    `bioCompleteness=${result.bioCompleteness}%, ` +
    `mentors=${result.associations.mentors?.length ?? 0}, ` +
    `formativeEvents=${result.formativeExperiences.length}`
  );

  return result;
}
