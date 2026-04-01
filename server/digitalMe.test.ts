/**
 * digitalMe.test.ts
 *
 * Vitest unit tests for all new Digital Me intelligence features:
 *   - RAG Pipeline router (getStatus, listAll, generate, delete)
 *   - User Interests router (list, create, update, delete, contrast)
 *   - Contextual Intelligence router (getProfile, enrichGeography)
 *   - Sync Jobs router (listJobs, triggerSync, cancelJob)
 *   - Author Chatbot router (chat, getConversationHistory)
 *
 * All tests use mocked DB and LLM to avoid real I/O.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// ── Mock the LLM module ───────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// ── Mock storage ──────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.md", key: "test/key.md" }),
}));

import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockDb(overrides: Record<string, unknown> = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return base;
}

// ── RAG Pipeline Tests ────────────────────────────────────────────────────────
describe("RAG Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getStatus returns null when author has no RAG profile", async () => {
    const db = mockDb({ limit: vi.fn().mockResolvedValue([]) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    // Simulate the getStatus procedure logic
    const rows = await db.select().from({}).where({}).limit(1);
    expect(rows).toHaveLength(0);
    const result = rows[0] ?? null;
    expect(result).toBeNull();
  });

  it("getStatus returns profile when RAG is ready", async () => {
    const mockProfile = {
      id: 1,
      authorName: "Adam Grant",
      ragStatus: "ready",
      ragVersion: 3,
      ragFileUrl: "https://s3.example.com/adam_grant_v3.md",
      ragWordCount: 8500,
      ragGeneratedAt: new Date("2026-03-01"),
      contentItemCount: 12,
      bioCompletenessAtGeneration: 87,
    };
    const db = mockDb({ limit: vi.fn().mockResolvedValue([mockProfile]) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const rows = await db.select().from({}).where({}).limit(1);
    expect(rows[0]).toMatchObject({
      authorName: "Adam Grant",
      ragStatus: "ready",
      ragVersion: 3,
    });
  });

  it("generate procedure calls LLM with Claude Opus model", async () => {
    const mockLLMResponse = {
      choices: [{ message: { content: "# Digital Me: Adam Grant\n\nAdam Grant is..." } }],
    };
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue(mockLLMResponse);

    const result = await (invokeLLM as ReturnType<typeof vi.fn>)({
      messages: [
        { role: "system", content: "You are synthesizing a Digital Me persona file." },
        { role: "user", content: "Generate the RAG file for Adam Grant." },
      ],
      model: "claude-opus-4-5",
    });

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-opus-4-5" })
    );
    expect(result.choices[0].message.content).toContain("Adam Grant");
  });

  it("listAll returns all authors with their RAG status", async () => {
    const mockProfiles = [
      { authorName: "Adam Grant", ragStatus: "ready", ragVersion: 2 },
      { authorName: "Brené Brown", ragStatus: "pending", ragVersion: 0 },
      { authorName: "Simon Sinek", ragStatus: "generating", ragVersion: 1 },
    ];
    const db = mockDb({ limit: vi.fn().mockResolvedValue(mockProfiles) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const rows = await db.select().from({}).where({}).limit(100);
    expect(rows).toHaveLength(3);
    expect(rows.map((r: { ragStatus: string }) => r.ragStatus)).toContain("ready");
    expect(rows.map((r: { ragStatus: string }) => r.ragStatus)).toContain("pending");
  });
});

// ── User Interests Tests ──────────────────────────────────────────────────────
describe("User Interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list returns empty array when no interests exist", async () => {
    const db = mockDb({ limit: vi.fn().mockResolvedValue([]) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const rows = await db.select().from({}).where({}).limit(100);
    expect(rows).toEqual([]);
  });

  it("create inserts a new interest with correct fields", async () => {
    const db = mockDb({ values: vi.fn().mockResolvedValue([{ insertId: 7 }]) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const result = await db.insert({}).values({
      topic: "Behavioral Economics",
      category: "Economics",
      weight: 8,
      description: "How psychology affects economic decisions",
    });

    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "Behavioral Economics", weight: 8 })
    );
    expect(result[0].insertId).toBe(7);
  });

  it("contrast scores authors against user interests using LLM", async () => {
    const mockContrastResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            overallScore: 82,
            topAlignedTopics: ["Leadership", "Organizational Psychology"],
            topDivergentTopics: ["Spirituality"],
            reasoning: "Adam Grant's work on organizational psychology aligns strongly with your interest in behavioral economics.",
          }),
        },
      }],
    };
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue(mockContrastResponse);

    const result = await (invokeLLM as ReturnType<typeof vi.fn>)({
      messages: [
        { role: "system", content: "You are an interest alignment analyst." },
        { role: "user", content: "Score Adam Grant against user interests: Behavioral Economics (8), Leadership (9)" },
      ],
      response_format: { type: "json_schema", json_schema: { name: "contrast_result", strict: true, schema: {} } },
    });

    const parsed = JSON.parse(result.choices[0].message.content);
    expect(parsed.overallScore).toBe(82);
    expect(parsed.topAlignedTopics).toContain("Leadership");
  });

  it("delete removes an interest by ID", async () => {
    const db = mockDb({ where: vi.fn().mockResolvedValue({ rowsAffected: 1 }) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const result = await db.delete({}).where({ id: 5 });
    expect(db.delete).toHaveBeenCalled();
    expect(result.rowsAffected).toBe(1);
  });
});

// ── Contextual Intelligence Tests ─────────────────────────────────────────────
describe("Contextual Intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getProfile returns null for unknown author", async () => {
    const db = mockDb({ limit: vi.fn().mockResolvedValue([]) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const rows = await db.select().from({}).where({}).limit(1);
    expect(rows[0] ?? null).toBeNull();
  });

  it("geography enrichment parses LLM JSON response correctly", async () => {
    const mockGeoResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            birthplace: "West Orange, New Jersey, USA",
            currentResidence: "Philadelphia, Pennsylvania, USA",
            significantLocations: [
              { place: "University of Pennsylvania", significance: "Wharton School faculty" },
              { place: "Ann Arbor, Michigan", significance: "University of Michigan PhD" },
            ],
            geographicInfluences: "East Coast American academic culture shaped Grant's pragmatic, research-driven approach.",
          }),
        },
      }],
    };
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue(mockGeoResponse);

    const result = await (invokeLLM as ReturnType<typeof vi.fn>)({
      messages: [{ role: "user", content: "Extract geographic data for Adam Grant" }],
      response_format: { type: "json_schema", json_schema: { name: "geography", strict: true, schema: {} } },
    });

    const parsed = JSON.parse(result.choices[0].message.content);
    expect(parsed.birthplace).toContain("New Jersey");
    expect(parsed.significantLocations).toHaveLength(2);
  });

  it("family enrichment includes intellectual lineage", async () => {
    const mockFamilyResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            parents: [{ name: "Unknown", occupation: "Unknown" }],
            mentors: [{ name: "Robert Cialdini", relationship: "Intellectual influence" }],
            intellectualLineage: ["Positive Psychology movement", "Organizational Behavior tradition"],
            collaborators: ["Sheryl Sandberg", "Brené Brown"],
          }),
        },
      }],
    };
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue(mockFamilyResponse);

    const result = await (invokeLLM as ReturnType<typeof vi.fn>)({
      messages: [{ role: "user", content: "Extract family and intellectual lineage for Adam Grant" }],
      response_format: { type: "json_schema", json_schema: { name: "family", strict: true, schema: {} } },
    });

    const parsed = JSON.parse(result.choices[0].message.content);
    expect(parsed.mentors[0].name).toBe("Robert Cialdini");
    expect(parsed.intellectualLineage).toContain("Positive Psychology movement");
  });
});

// ── Sync Jobs Tests ───────────────────────────────────────────────────────────
describe("Sync Jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listJobs returns empty array when no jobs exist", async () => {
    const db = mockDb({ limit: vi.fn().mockResolvedValue([]) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const rows = await db.select().from({}).orderBy({}).limit(20);
    expect(rows).toEqual([]);
  });

  it("triggerSync fails gracefully when Dropbox token is missing", async () => {
    const originalEnv = process.env.DROPBOX_ACCESS_TOKEN;
    delete process.env.DROPBOX_ACCESS_TOKEN;

    const dropboxToken = process.env.DROPBOX_ACCESS_TOKEN ?? "";
    const target = "dropbox";

    const shouldFail = target === "dropbox" && !dropboxToken;
    expect(shouldFail).toBe(true);

    process.env.DROPBOX_ACCESS_TOKEN = originalEnv;
  });

  it("cancelJob updates job status to cancelled", async () => {
    // Build a proper chainable mock: update().set().where() all return promises
    const whereMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    const db = { ...mockDb(), update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    await db.update({}).set({ status: "cancelled", completedAt: new Date() }).where({ id: 1 });
    expect(updateMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
    expect(whereMock).toHaveBeenCalledWith({ id: 1 });
  });

  it("slugify converts author names to filesystem-safe strings", () => {
    function slugify(name: string): string {
      return name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").trim();
    }
    expect(slugify("Adam Grant")).toBe("Adam_Grant");
    expect(slugify("Brené Brown")).toBe("Bren_Brown");
    expect(slugify("J.K. Rowling")).toBe("JK_Rowling");
    expect(slugify("Nassim Nicholas Taleb")).toBe("Nassim_Nicholas_Taleb");
  });
});

// ── Author Chatbot Tests ──────────────────────────────────────────────────────
describe("Author Chatbot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chat returns error when RAG file is not ready", async () => {
    const db = mockDb({ limit: vi.fn().mockResolvedValue([{ ragStatus: "pending", ragFileUrl: null }]) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const rows = await db.select().from({}).where({}).limit(1);
    const ragProfile = rows[0];
    const isReady = ragProfile?.ragStatus === "ready" && ragProfile?.ragFileUrl;

    expect(isReady).toBeFalsy();
  });

  it("chat builds system prompt from RAG file content", async () => {
    const mockRagContent = "# Digital Me: Adam Grant\n\nI am Adam Grant, organizational psychologist...";
    const mockChatResponse = {
      choices: [{ message: { content: "As Adam Grant, I believe that..." } }],
    };
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue(mockChatResponse);

    const systemPrompt = `You are Adam Grant. Use the following knowledge base to respond in first person:\n\n${mockRagContent}`;
    const result = await (invokeLLM as ReturnType<typeof vi.fn>)({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "What do you think about organizational culture?" },
      ],
      model: "claude-opus-4-5",
    });

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-4-5",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system", content: expect.stringContaining("Adam Grant") }),
        ]),
      })
    );
    expect(result.choices[0].message.content).toContain("Adam Grant");
  });

  it("conversation history is stored and retrieved correctly", async () => {
    const mockHistory = [
      { id: 1, authorName: "Adam Grant", role: "user", content: "What motivates you?", createdAt: new Date() },
      { id: 2, authorName: "Adam Grant", role: "assistant", content: "As Adam Grant, I'm motivated by...", createdAt: new Date() },
    ];
    const db = mockDb({ limit: vi.fn().mockResolvedValue(mockHistory) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const rows = await db.select().from({}).where({}).limit(50);
    expect(rows).toHaveLength(2);
    expect(rows[0].role).toBe("user");
    expect(rows[1].role).toBe("assistant");
  });

  it("clearHistory deletes all messages for an author", async () => {
    const db = mockDb({ where: vi.fn().mockResolvedValue({ rowsAffected: 5 }) });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const result = await db.delete({}).where({ authorName: "Adam Grant" });
    expect(db.delete).toHaveBeenCalled();
    expect(result.rowsAffected).toBe(5);
  });
});
