/**
 * richBio.ts
 * Double-pass LLM enrichment for author rich bio + professional entries.
 *
 * Pass 1 — Research pass (Perplexity / web-grounded):
 *   Gather raw facts: career history, education, notable roles, personal background.
 *
 * Pass 2 — Synthesis pass (Claude / GPT):
 *   Turn raw facts into a structured JSON with:
 *   - fullBio: 3-5 paragraph professional + personal narrative
 *   - professionalSummary: 1 paragraph executive summary
 *   - personalNote: optional personal anecdote or fun fact
 *   - professionalEntries: resume-style array of {title, org, period, description}
 */

import { invokeLLM } from "../_core/llm";

export interface ProfessionalEntry {
  title: string;
  org: string;
  period: string;
  description: string;
}

export interface RichBioResult {
  fullBio: string;
  professionalSummary: string;
  personalNote?: string;
  professionalEntries: ProfessionalEntry[];
  enrichedAt: string;
  model: string;
}

/**
 * Perform a double-pass LLM enrichment for an author's rich bio.
 * Returns null if the author is unknown or enrichment fails.
 */
export async function enrichRichBio(
  authorName: string,
  existingBio?: string | null,
  category?: string | null
): Promise<RichBioResult | null> {
  try {
    // ── Pass 1: Research pass ─────────────────────────────────────────────────
    const researchPrompt = `You are a professional biographer and researcher. Gather comprehensive factual information about ${authorName}${category ? ` (${category})` : ""}.

Research and provide detailed information about:
1. Full career history: every significant role, position, company, organization they have been associated with (with approximate years)
2. Educational background: universities, degrees, notable programs
3. Key achievements: awards, bestselling books, notable projects, companies founded
4. Personal background: where they grew up, family context if publicly known, personal philosophy
5. Current activities: what they are doing now, recent projects
6. Notable quotes or ideas they are known for

${existingBio ? `Existing bio for context:\n${existingBio}\n\nExpand significantly beyond this.` : ""}

Be thorough and factual. Include dates and organizations wherever possible.`;

    const researchResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a thorough research assistant with access to comprehensive knowledge about public figures, authors, and thought leaders. Provide detailed, factual information.",
        },
        { role: "user", content: researchPrompt },
      ],
    });

    const rawResearchContent =
      researchResponse.choices?.[0]?.message?.content ?? "";
    const rawResearch = typeof rawResearchContent === "string" ? rawResearchContent : "";

    if (!rawResearch || rawResearch.length < 100) {
      return null;
    }

    // ── Pass 2: Synthesis pass ────────────────────────────────────────────────
    const synthesisPrompt = `Based on the following research about ${authorName}, create a structured, polished author profile in JSON format.

Research data:
${rawResearch}

Return a JSON object with exactly this structure:
{
  "fullBio": "3-5 paragraph professional and personal narrative biography. First paragraph: who they are and what they are known for. Second paragraph: career journey and key roles. Third paragraph: major achievements and impact. Fourth paragraph (optional): personal background and philosophy. Fifth paragraph (optional): current work and future direction.",
  "professionalSummary": "One concise paragraph (2-3 sentences) executive summary suitable for a conference program or book jacket.",
  "personalNote": "Optional: one interesting personal anecdote, fun fact, or humanizing detail. Omit if nothing compelling is known.",
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
- fullBio should be engaging, professional, and suitable for a library or academic context
- Do not fabricate information — only include what is known from the research
- Return ONLY valid JSON, no markdown fences`;

    const synthesisResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a professional biographer who writes polished, accurate author profiles for library and academic contexts. You always return valid JSON.",
        },
        { role: "user", content: synthesisPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "rich_bio",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fullBio: { type: "string" },
              professionalSummary: { type: "string" },
              personalNote: { type: "string" },
              professionalEntries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    org: { type: "string" },
                    period: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "org", "period", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "fullBio",
              "professionalSummary",
              "personalNote",
              "professionalEntries",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = synthesisResponse.choices?.[0]?.message?.content ?? "";
    const raw = typeof rawContent === "string" ? rawContent : "";
    let parsed: Omit<RichBioResult, "enrichedAt" | "model">;

    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: try to extract JSON from markdown fences
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        return null;
      }
    }

    return {
      fullBio: parsed.fullBio ?? "",
      professionalSummary: parsed.professionalSummary ?? "",
      personalNote: parsed.personalNote,
      professionalEntries: parsed.professionalEntries ?? [],
      enrichedAt: new Date().toISOString(),
      model: "double-pass-llm",
    };
  } catch (err) {
    console.error(`[richBio] Error enriching ${authorName}:`, err);
    return null;
  }
}
