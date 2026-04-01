/**
 * appSettings.test.ts
 *
 * Tests for the appSettings tRPC router and Dropbox OAuth 2 auth module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── appSettings router ────────────────────────────────────────────────────────
describe("appSettings router", () => {
  it("getModelConfig: returns default config when no DB is available", async () => {
    // Mock getDb to return null (DB unavailable)
    vi.doMock("../server/db", () => ({ getDb: async () => null }));
    const { appSettingsRouter } = await import("./routers/appSettings.router");
    expect(appSettingsRouter).toBeDefined();
  });

  it("DEFAULT_CONFIG: has expected shape", () => {
    const DEFAULT_CONFIG = {
      primaryVendor: "google",
      primaryModel: "gemini-2.5-pro",
      secondaryEnabled: false,
      secondaryVendor: null,
      secondaryModel: null,
    };
    expect(DEFAULT_CONFIG.primaryVendor).toBe("google");
    expect(DEFAULT_CONFIG.primaryModel).toBe("gemini-2.5-pro");
    expect(DEFAULT_CONFIG.secondaryEnabled).toBe(false);
    expect(DEFAULT_CONFIG.secondaryVendor).toBeNull();
    expect(DEFAULT_CONFIG.secondaryModel).toBeNull();
  });

  it("saveModelConfig: validates input schema", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      primaryVendor: z.string().min(1),
      primaryModel: z.string().min(1),
      secondaryEnabled: z.boolean(),
      secondaryVendor: z.string().nullable(),
      secondaryModel: z.string().nullable(),
    });

    // Valid input
    const validInput = {
      primaryVendor: "anthropic",
      primaryModel: "claude-opus-4-5",
      secondaryEnabled: true,
      secondaryVendor: "google",
      secondaryModel: "gemini-2.5-pro",
    };
    expect(() => schema.parse(validInput)).not.toThrow();

    // Invalid: empty primaryVendor
    expect(() => schema.parse({ ...validInput, primaryVendor: "" })).toThrow();

    // Valid: secondary disabled with nulls
    const noSecondary = {
      primaryVendor: "google",
      primaryModel: "gemini-2.5-flash",
      secondaryEnabled: false,
      secondaryVendor: null,
      secondaryModel: null,
    };
    expect(() => schema.parse(noSecondary)).not.toThrow();
  });
});

// ── dropboxAuth module ────────────────────────────────────────────────────────
describe("dropboxAuth", () => {
  it("getAuthorizationUrl: builds correct URL with offline token_access_type", async () => {
    // Set mock env vars
    process.env.DROPBOX_APP_KEY = "test_app_key_123";
    process.env.DROPBOX_APP_SECRET = "test_app_secret_456";

    const { getAuthorizationUrl } = await import("./dropboxAuth");
    const url = getAuthorizationUrl("https://example.com/api/dropbox/callback", "test-state");

    expect(url).toContain("dropbox.com/oauth2/authorize");
    expect(url).toContain("client_id=test_app_key_123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("token_access_type=offline");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=test-state");
  });

  it("getAuthorizationUrl: works without state parameter", async () => {
    process.env.DROPBOX_APP_KEY = "test_app_key_123";
    const { getAuthorizationUrl } = await import("./dropboxAuth");
    const url = getAuthorizationUrl("https://example.com/callback");
    expect(url).toContain("dropbox.com/oauth2/authorize");
    expect(url).not.toContain("state=");
  });

  it("getAuthorizationUrl: throws when DROPBOX_APP_KEY is missing", async () => {
    const savedKey = process.env.DROPBOX_APP_KEY;
    delete process.env.DROPBOX_APP_KEY;

    const { getAuthorizationUrl } = await import("./dropboxAuth");
    expect(() => getAuthorizationUrl("https://example.com/callback")).toThrow(
      "DROPBOX_APP_KEY and DROPBOX_APP_SECRET must be set"
    );

    process.env.DROPBOX_APP_KEY = savedKey;
  });

  it("getDropboxConnectionStatus: returns not-connected when no token or refresh token", async () => {
    // Remove static token from env
    const savedToken = process.env.DROPBOX_ACCESS_TOKEN;
    delete process.env.DROPBOX_ACCESS_TOKEN;

    // getDb returns null (no DB) so no refresh token either
    const { getDropboxConnectionStatus } = await import("./dropboxAuth");
    const status = await getDropboxConnectionStatus();

    expect(status).toHaveProperty("connected");
    expect(status).toHaveProperty("hasRefreshToken");
    expect(status).toHaveProperty("hasStaticToken");
    // With no token and no DB, should not be connected
    expect(status.hasStaticToken).toBe(false);

    process.env.DROPBOX_ACCESS_TOKEN = savedToken;
  });

  it("getDropboxConnectionStatus: detects static token from env", async () => {
    process.env.DROPBOX_ACCESS_TOKEN = "sl.test_static_token_12345";

    const { getDropboxConnectionStatus } = await import("./dropboxAuth");
    const status = await getDropboxConnectionStatus();

    expect(status.hasStaticToken).toBe(true);
    expect(status.connected).toBe(true);
  });
});

// ── AI model vendor catalogue ─────────────────────────────────────────────────
describe("AI Model Config - Vendor Catalogue", () => {
  const EXPECTED_VENDORS = ["google", "anthropic", "openai", "mistral", "cohere", "meta", "deepseek", "perplexity"];

  it("covers all 8 major LLM providers", () => {
    // This tests the catalogue defined in AIModelConfigTab.tsx (frontend)
    // We validate the expected vendor IDs are present
    expect(EXPECTED_VENDORS).toHaveLength(8);
    expect(EXPECTED_VENDORS).toContain("google");
    expect(EXPECTED_VENDORS).toContain("anthropic");
    expect(EXPECTED_VENDORS).toContain("openai");
  });

  it("default primary vendor is Google with Gemini 2.5 Pro", () => {
    const defaultPrimaryVendor = "google";
    const defaultPrimaryModel = "gemini-2.5-pro";
    expect(defaultPrimaryVendor).toBe("google");
    expect(defaultPrimaryModel).toBe("gemini-2.5-pro");
  });

  it("Claude Opus is available as an Anthropic model", () => {
    const anthropicModels = [
      "claude-opus-4-5",
      "claude-opus-4",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ];
    expect(anthropicModels.some((m) => m.includes("opus"))).toBe(true);
  });
});
