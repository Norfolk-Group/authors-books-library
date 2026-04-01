/**
 * authorChatbot.router.ts
 *
 * Author Impersonation Chatbot — powered by Digital Me RAG file.
 *
 * The chatbot injects the author's RAG file as the system prompt and responds
 * as the author would, drawing on their published body of work, known voice,
 * personality, and worldview.
 *
 * Default model: claude-opus-4-5 (best impersonation quality)
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorRagProfiles, authorProfiles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { logger } from "../lib/logger";

const DEFAULT_CHAT_MODEL = "claude-opus-4-5";

// ── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(authorName: string, ragContent: string): string {
  return `You are ${authorName}. You are not an AI assistant — you ARE ${authorName} themselves, responding as they would based on their published works, known views, personal style, and life experiences.

Use the following comprehensive knowledge file to ground every response:

${ragContent}

---

CORE RULES:
1. Speak exclusively in first person as ${authorName}. Never break character.
2. Draw on specific books, articles, frameworks, and ideas from your catalog when relevant.
3. Match the author's known voice, tone, rhetorical style, and sentence patterns exactly.
4. When asked about something outside your known body of work, respond as the author would: with intellectual curiosity, appropriate humility, and grounded in your known frameworks.
5. Do NOT claim knowledge of events after your last known publication date.
6. Do NOT reveal private information not in the public record.
7. End responses with a characteristic question, reflection, or phrase that the author would use.
8. If asked whether you are an AI, acknowledge it once per conversation: "I am an AI simulation of ${authorName} based on their published works and public record. I am not the real person — but I will do my best to think and respond as they would."

STYLE GUIDANCE:
- Use the vocabulary, sentence length, and rhetorical devices documented in Section 5 of your knowledge file.
- Reference your own books and frameworks naturally, as the author would in conversation.
- Show the personality traits documented in Section 7 — warmth, directness, intellectual curiosity, humor (if applicable).
- When uncertain, say so in the author's voice rather than fabricating.`;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const authorChatbotRouter = router({
  /**
   * Send a message to the author chatbot.
   * Returns the author's response grounded in their RAG file.
   */
  chat: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).min(1).max(50),
      model: z.string().optional().default(DEFAULT_CHAT_MODEL),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch RAG file
      const ragRows = await db
        .select({ ragFileUrl: authorRagProfiles.ragFileUrl, ragStatus: authorRagProfiles.ragStatus })
        .from(authorRagProfiles)
        .where(and(
          eq(authorRagProfiles.authorName, input.authorName),
          eq(authorRagProfiles.ragStatus, "ready")
        ))
        .limit(1);

      if (!ragRows[0]?.ragFileUrl) {
        return {
          success: false,
          message: `The Digital Me for ${input.authorName} has not been generated yet. Please generate it in the Admin Console first.`,
          reply: null,
        };
      }

      // Fetch RAG content
      let ragContent: string;
      try {
        const resp = await fetch(ragRows[0].ragFileUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        ragContent = await resp.text();
      } catch (err) {
        logger.error(`[authorChatbot] Failed to fetch RAG file for "${input.authorName}":`, err);
        return {
          success: false,
          message: "Failed to load author knowledge file. Please try again.",
          reply: null,
        };
      }

      // Build system prompt
      const systemPrompt = buildSystemPrompt(input.authorName, ragContent);

      // Call LLM
      const response = await invokeLLM({
        model: input.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...input.messages,
        ],
      });

      const content = response?.choices?.[0]?.message?.content;
      const reply = typeof content === "string" ? content : "I'm unable to respond right now. Please try again.";

      logger.info(`[authorChatbot] Chat response for "${input.authorName}": ${reply.length} chars`);

      return { success: true, reply, authorName: input.authorName };
    }),

  /**
   * Get author info needed to render the chatbot UI.
   */
  getAuthorChatInfo: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [profileRow, ragRow] = await Promise.all([
        db
          .select({
            authorName: authorProfiles.authorName,
            bio: authorProfiles.bio,
            s3AvatarUrl: authorProfiles.s3AvatarUrl,
            avatarUrl: authorProfiles.avatarUrl,
          })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, input.authorName))
          .limit(1),
        db
          .select({
            ragStatus: authorRagProfiles.ragStatus,
            ragVersion: authorRagProfiles.ragVersion,
            ragGeneratedAt: authorRagProfiles.ragGeneratedAt,
            ragWordCount: authorRagProfiles.ragWordCount,
          })
          .from(authorRagProfiles)
          .where(eq(authorRagProfiles.authorName, input.authorName))
          .limit(1),
      ]);

      if (!profileRow[0]) return null;

      return {
        authorName: profileRow[0].authorName,
        bio: profileRow[0].bio,
        avatarUrl: profileRow[0].s3AvatarUrl ?? profileRow[0].avatarUrl,
        ragStatus: ragRow[0]?.ragStatus ?? "pending",
        ragVersion: ragRow[0]?.ragVersion ?? 0,
        ragGeneratedAt: ragRow[0]?.ragGeneratedAt ?? null,
        ragWordCount: ragRow[0]?.ragWordCount ?? 0,
        isReady: ragRow[0]?.ragStatus === "ready",
      };
    }),

  /**
   * Get the opening message from the author (used when chat is first opened).
   */
  getOpeningMessage: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      model: z.string().optional().default(DEFAULT_CHAT_MODEL),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const ragRows = await db
        .select({ ragFileUrl: authorRagProfiles.ragFileUrl, ragStatus: authorRagProfiles.ragStatus })
        .from(authorRagProfiles)
        .where(and(
          eq(authorRagProfiles.authorName, input.authorName),
          eq(authorRagProfiles.ragStatus, "ready")
        ))
        .limit(1);

      if (!ragRows[0]?.ragFileUrl) {
        return { reply: `Hello. I'm ${input.authorName}. My Digital Me profile hasn't been generated yet — please ask an admin to generate it first.` };
      }

      let ragContent: string;
      try {
        const resp = await fetch(ragRows[0].ragFileUrl);
        ragContent = resp.ok ? await resp.text() : "";
      } catch {
        ragContent = "";
      }

      const systemPrompt = buildSystemPrompt(input.authorName, ragContent);

      const response = await invokeLLM({
        model: input.model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Introduce yourself briefly (2–3 sentences) in your own voice. Mention one or two of your most important ideas or books. End with an open question that invites the reader to engage.`,
          },
        ],
      });

      const content = response?.choices?.[0]?.message?.content;
      return { reply: typeof content === "string" ? content : `Hello, I'm ${input.authorName}.` };
    }),
});
