/**
 * authorChatbot.router.ts
 *
 * Author Impersonation Chatbot — powered by Digital Me RAG file.
 *
 * The chatbot uses semantic chunk retrieval from the rag_files Neon namespace
 * to surface the most relevant sections of the author's knowledge file for each
 * user message, rather than injecting the entire file as a wall of text.
 *
 * Fallback: if no rag_files vectors exist for the author, falls back to full-file
 * injection from S3 (legacy behaviour) so the chatbot always works.
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
import { semanticSearch, embedText } from "../services/ragPipeline.service";
import { queryVectors } from "../services/neonVector.service";

const DEFAULT_CHAT_MODEL = "claude-opus-4-5";
// How many RAG chunks to retrieve per user message turn
const RAG_CHUNKS_PER_TURN = 6;
// How many content_item hits to inject as supplementary context
const CONTENT_HITS_PER_TURN = 3;
// Max chars of fallback full-file content to inject when no chunks exist
const FALLBACK_RAG_CHARS = 8000;

// ── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(authorName: string, ragContext: string): string {
  return `You are ${authorName}. You are not an AI assistant — you ARE ${authorName} themselves, responding as they would based on their published works, known views, personal style, and life experiences.

Use the following knowledge excerpts — drawn from your comprehensive Digital Me profile — to ground every response:

${ragContext}

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
- Use the vocabulary, sentence length, and rhetorical devices documented in your knowledge file.
- Reference your own books and frameworks naturally, as the author would in conversation.
- Show your personality traits — warmth, directness, intellectual curiosity, humor (if applicable).
- When uncertain, say so in your own voice rather than fabricating.`;
}

// ── RAG Context Retrieval ─────────────────────────────────────────────────────

/**
 * Retrieve the most relevant chunks from the rag_files namespace for a given query.
 * Falls back to full-file injection if no chunks are indexed for this author.
 */
async function retrieveRagContext(
  authorName: string,
  query: string,
  ragFileUrl: string | null
): Promise<string> {
  // 1. Try semantic chunk retrieval from rag_files namespace
  try {
    const queryEmbedding = await embedText(query);
    const ragChunks = await queryVectors(queryEmbedding, "rag_files", {
      topK: RAG_CHUNKS_PER_TURN,
      filter: { authorName: { $eq: authorName } },
    });

    if (ragChunks.length > 0) {
      // Sort by chunk index to preserve narrative flow
      const sorted = [...ragChunks].sort((a, b) =>
        (a.metadata.chunkIndex ?? 0) - (b.metadata.chunkIndex ?? 0)
      );
      const context = sorted
        .map((c, i) => `[Excerpt ${i + 1}]\n${c.metadata.text}`)
        .join("\n\n");
      logger.info(`[authorChatbot] Retrieved ${ragChunks.length} RAG chunks from Neon pgvector for "${authorName}"`);
      return context;
    }
  } catch (err) {
    logger.warn(`[authorChatbot] rag_files chunk retrieval failed, falling back to full file:`, err);
  }

  // 2. Fallback: fetch full RAG file from S3 and truncate
  if (ragFileUrl) {
    try {
      const resp = await fetch(ragFileUrl);
      if (resp.ok) {
        const fullText = await resp.text();
        const truncated = fullText.slice(0, FALLBACK_RAG_CHARS);
        logger.info(`[authorChatbot] Fallback: injecting ${truncated.length} chars from S3 RAG file for "${authorName}"`);
        return truncated;
      }
    } catch (err) {
      logger.error(`[authorChatbot] Failed to fetch fallback RAG file for "${authorName}":`, err);
    }
  }

  return "";
}

// ── Router ────────────────────────────────────────────────────────────────────
export const authorChatbotRouter = router({
  /**
   * Send a message to the author chatbot.
   * Uses semantic chunk retrieval from rag_files namespace (P0 fix).
   * Also injects relevant content_items as supplementary context.
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

      // Check RAG profile exists
      const ragRows = await db
        .select({ ragFileUrl: authorRagProfiles.ragFileUrl, ragStatus: authorRagProfiles.ragStatus })
        .from(authorRagProfiles)
        .where(and(
          eq(authorRagProfiles.authorName, input.authorName),
          eq(authorRagProfiles.ragStatus, "ready")
        ))
        .limit(1);

      if (!ragRows[0]) {
        return {
          success: false,
          message: `The Digital Me for ${input.authorName} has not been generated yet. Please generate it in the Admin Console first.`,
          reply: null,
        };
      }

      // Get the last user message to use as the retrieval query
      const lastUserMsg = [...input.messages].reverse().find(m => m.role === "user");
      const retrievalQuery = lastUserMsg?.content ?? input.authorName;

      // Retrieve relevant RAG chunks (P0 fix: chunk retrieval instead of full-file injection)
      const ragContext = await retrieveRagContext(
        input.authorName,
        retrievalQuery,
        ragRows[0].ragFileUrl ?? null
      );

      if (!ragContext) {
        return {
          success: false,
          message: "Failed to load author knowledge. Please try again.",
          reply: null,
        };
      }

      // Supplementary context: content_items for this author (articles, podcasts, etc.)
      let supplementaryContext = "";
      try {
        if (lastUserMsg && typeof lastUserMsg.content === "string") {
          const contentHits = await semanticSearch({
            query: lastUserMsg.content,
            namespace: "content_items",
            filterAuthor: input.authorName,
            topK: CONTENT_HITS_PER_TURN,
          });
          if (contentHits.length > 0) {
            supplementaryContext = "\n\n---\nSUPPLEMENTARY CONTENT (articles, podcasts, talks):\n" +
              contentHits.map((h, i) => `[${i + 1}] ${h.snippet}`).join("\n");
            logger.info(`[authorChatbot] Injected ${contentHits.length} content_items hits for "${input.authorName}"`);
          }
        }
      } catch (err) {
        logger.warn(`[authorChatbot] Content items search failed (non-fatal):`, err);
      }

      // Build system prompt with retrieved chunks + supplementary context
      const systemPrompt = buildSystemPrompt(input.authorName, ragContext + supplementaryContext);

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
   * Uses chunk retrieval for the opening greeting context.
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

      // For the opening message, retrieve chunks about the author's identity and key ideas
      const openingQuery = `${input.authorName} identity key ideas books personality introduction`;
      const ragContext = await retrieveRagContext(
        input.authorName,
        openingQuery,
        ragRows[0].ragFileUrl ?? null
      );

      const systemPrompt = buildSystemPrompt(input.authorName, ragContext);
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
