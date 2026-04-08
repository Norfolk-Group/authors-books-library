/**
 * Validates that DROPBOX_BACKUP_FOLDER and DROPBOX_INBOX_FOLDER env vars
 * point to real, accessible folders in Dropbox.
 */
import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
dotenv.config();

const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN ?? "";
const APP_KEY = process.env.DROPBOX_APP_KEY ?? "";
const APP_SECRET = process.env.DROPBOX_APP_SECRET ?? "";
const BACKUP_FOLDER = process.env.DROPBOX_BACKUP_FOLDER ?? "";
const INBOX_FOLDER = process.env.DROPBOX_INBOX_FOLDER ?? "";

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
      client_id: APP_KEY,
      client_secret: APP_SECRET,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function folderExists(accessToken: string, path: string): Promise<boolean> {
  const res = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  const data = (await res.json()) as { ".tag"?: string; error_summary?: string };
  return data[".tag"] === "folder";
}

describe("Dropbox folder path secrets", () => {
  it("DROPBOX_BACKUP_FOLDER env var is set", () => {
    expect(BACKUP_FOLDER).toBeTruthy();
    expect(BACKUP_FOLDER).toContain("/Apps NAI");
  });

  it("DROPBOX_INBOX_FOLDER env var is set", () => {
    expect(INBOX_FOLDER).toBeTruthy();
    expect(INBOX_FOLDER).toContain("/Apps NAI");
  });

  it("DROPBOX_BACKUP_FOLDER exists in Dropbox", async () => {
    const token = await getAccessToken();
    const exists = await folderExists(token, BACKUP_FOLDER);
    expect(exists).toBe(true);
  }, 15000);

  it("DROPBOX_INBOX_FOLDER exists in Dropbox", async () => {
    const token = await getAccessToken();
    const exists = await folderExists(token, INBOX_FOLDER);
    expect(exists).toBe(true);
  }, 15000);
});
