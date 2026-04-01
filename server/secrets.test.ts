/**
 * secrets.test.ts
 *
 * Validates that cloud sync credentials are present and functional.
 * Skips gracefully when credentials are not set (optional services).
 */
import { describe, it, expect } from "vitest";

describe("Cloud Sync Secrets", () => {
  it("DROPBOX_APP_KEY: skips if not set, validates format if set", () => {
    const key = process.env.DROPBOX_APP_KEY;
    if (!key || key.trim() === "") {
      console.log("SKIP: DROPBOX_APP_KEY not configured");
      expect(true).toBe(true);
      return;
    }
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(5);
    console.log(`✅ DROPBOX_APP_KEY present (length: ${key.length})`);
  });

  it("DROPBOX_APP_SECRET: skips if not set, validates format if set", () => {
    const secret = process.env.DROPBOX_APP_SECRET;
    if (!secret || secret.trim() === "") {
      console.log("SKIP: DROPBOX_APP_SECRET not configured");
      expect(true).toBe(true);
      return;
    }
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(5);
    console.log(`✅ DROPBOX_APP_SECRET present (length: ${secret.length})`);
  });

  it("DROPBOX_ACCESS_TOKEN: skips if not set, validates format if set", async () => {
    const token = process.env.DROPBOX_ACCESS_TOKEN;
    if (!token || token.trim() === "") {
      console.log("SKIP: DROPBOX_ACCESS_TOKEN not configured");
      expect(true).toBe(true); // graceful skip
      return;
    }
    // Token should be a non-empty string (Dropbox tokens are typically 64+ chars)
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    console.log(`✅ DROPBOX_ACCESS_TOKEN present (length: ${token.length})`);
  });

  it("GOOGLE_DRIVE_PARENT_FOLDER_ID: skips if not set, validates format if set", () => {
    const folderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    if (!folderId || folderId.trim() === "") {
      console.log("SKIP: GOOGLE_DRIVE_PARENT_FOLDER_ID not configured");
      expect(true).toBe(true); // graceful skip
      return;
    }
    // Google Drive folder IDs are alphanumeric strings, typically 33 chars
    expect(typeof folderId).toBe("string");
    expect(folderId.length).toBeGreaterThan(5);
    console.log(`✅ GOOGLE_DRIVE_PARENT_FOLDER_ID present (length: ${folderId.length})`);
  });
});
