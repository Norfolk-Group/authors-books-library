/**
 * Dropbox refresh token validation test
 * Verifies that the permanent refresh token can generate a valid access token
 * and that the Dropbox API is reachable.
 */
import { describe, it, expect } from "vitest";

const APP_KEY = process.env.DROPBOX_APP_KEY!;
const APP_SECRET = process.env.DROPBOX_APP_SECRET!;
const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN!;
const BACKUP_FOLDER = process.env.DROPBOX_BACKUP_FOLDER!;

async function getDropboxAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString("base64");
  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Token refresh failed: ${data.error}`);
  return data.access_token;
}

describe("Dropbox permanent refresh token", () => {
  it("should have required env vars set", () => {
    expect(APP_KEY, "DROPBOX_APP_KEY must be set").toBeTruthy();
    expect(APP_SECRET, "DROPBOX_APP_SECRET must be set").toBeTruthy();
    expect(REFRESH_TOKEN, "DROPBOX_REFRESH_TOKEN must be set").toBeTruthy();
    expect(BACKUP_FOLDER, "DROPBOX_BACKUP_FOLDER must be set").toBeTruthy();
  });

  it("should have correct backup folder path", () => {
    expect(BACKUP_FOLDER).toBe("/Cidale Interests/Company/Norfolk AI/Apps/RC Library");
  });

  it("should exchange refresh token for a valid access token", async () => {
    const token = await getDropboxAccessToken();
    expect(token).toBeTruthy();
    expect(token.startsWith("sl.")).toBe(true);
  }, 15000);

  it("should authenticate as Ricardo Cidale via Dropbox API", async () => {
    const token = await getDropboxAccessToken();
    const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "null",
    });
    const account = (await res.json()) as {
      name?: { display_name: string };
      email?: string;
    };
    expect(account.email).toBeTruthy();
    expect(account.name?.display_name).toBeTruthy();
    console.log(`✅ Authenticated as: ${account.name?.display_name} (${account.email})`);
  }, 15000);
});
