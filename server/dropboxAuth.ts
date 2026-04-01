/**
 * dropboxAuth.ts
 *
 * Dropbox OAuth 2 token management with automatic refresh.
 *
 * Flow:
 *   1. User visits /api/dropbox/connect → redirected to Dropbox authorization page
 *   2. Dropbox redirects to /api/dropbox/callback?code=XXX
 *   3. Server exchanges code for { access_token, refresh_token, expires_in }
 *   4. refresh_token is stored in the DB (app_settings table)
 *   5. Before every Dropbox API call, getDropboxToken() is called:
 *      - If cached access token is still valid (>5 min remaining), return it
 *      - Otherwise, call /oauth2/token with refresh_token to get a new access token
 *      - Cache the new token in memory with its expiry
 *
 * Environment variables required:
 *   DROPBOX_APP_KEY     — from dropbox.com/developers/apps
 *   DROPBOX_APP_SECRET  — from dropbox.com/developers/apps
 *
 * The refresh token is stored in the database (app_settings table, key = "dropbox_refresh_token")
 * so it survives server restarts.
 */

import { getDb } from "./db";
import { appSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── In-memory token cache ─────────────────────────────────────────────────────
interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix ms
}

let tokenCache: TokenCache | null = null;

const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const SETTINGS_KEY_REFRESH_TOKEN = "dropbox_refresh_token";
const SETTINGS_KEY_CONNECTED_AT = "dropbox_connected_at";
const SETTINGS_KEY_ACCOUNT_EMAIL = "dropbox_account_email";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAppCredentials(): { appKey: string; appSecret: string } {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error(
      "DROPBOX_APP_KEY and DROPBOX_APP_SECRET must be set to use Dropbox OAuth 2"
    );
  }
  return { appKey, appSecret };
}

/** Read a setting value from the app_settings table */
async function readSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

/** Write a setting value to the app_settings table */
async function writeSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a valid Dropbox access token, refreshing it if necessary.
 * Throws if no refresh token is stored (user has not connected Dropbox yet).
 */
export async function getDropboxToken(): Promise<string> {
  // 1. Check in-memory cache (must have >5 min remaining)
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - now > 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  // 2. Check for a legacy static token (DROPBOX_ACCESS_TOKEN env var)
  //    This is used as a fallback when the OAuth flow has not been completed.
  const staticToken = process.env.DROPBOX_ACCESS_TOKEN;

  // 3. Try to refresh using stored refresh token
  const refreshToken = await readSetting(SETTINGS_KEY_REFRESH_TOKEN);
  if (refreshToken) {
    const newToken = await refreshAccessToken(refreshToken);
    return newToken;
  }

  // 4. Fall back to static token if available
  if (staticToken && staticToken.trim().length > 0) {
    return staticToken;
  }

  throw new Error(
    "Dropbox is not connected. Please complete the OAuth 2 authorization flow via Admin → Sync → Connect Dropbox."
  );
}

/**
 * Exchange a refresh token for a new access token and update the cache.
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { appKey, appSecret } = getAppCredentials();

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: appKey,
    client_secret: appSecret,
  });

  const res = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dropbox token refresh failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  // Cache the new token
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called from the /api/dropbox/callback route.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; accountEmail: string }> {
  const { appKey, appSecret } = getAppCredentials();

  const params = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    client_id: appKey,
    client_secret: appSecret,
  });

  const res = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dropbox code exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    account_id: string;
  };

  // Fetch account info to get the email
  let accountEmail = "Unknown";
  try {
    const accountRes = await fetch(
      "https://api.dropboxapi.com/2/users/get_current_account",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          "Content-Type": "application/json",
        },
        body: "null",
      }
    );
    if (accountRes.ok) {
      const accountData = (await accountRes.json()) as { email?: string };
      accountEmail = accountData.email ?? "Unknown";
    }
  } catch {
    // Non-fatal — account email is cosmetic
  }

  // Persist refresh token and metadata to DB
  await writeSetting(SETTINGS_KEY_REFRESH_TOKEN, data.refresh_token);
  await writeSetting(SETTINGS_KEY_CONNECTED_AT, new Date().toISOString());
  await writeSetting(SETTINGS_KEY_ACCOUNT_EMAIL, accountEmail);

  // Update in-memory cache
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accountEmail,
  };
}

/**
 * Generate the Dropbox authorization URL for the OAuth 2 flow.
 * The user is redirected here to grant access.
 */
export function getAuthorizationUrl(redirectUri: string, state?: string): string {
  const { appKey } = getAppCredentials();

  const params = new URLSearchParams({
    client_id: appKey,
    response_type: "code",
    redirect_uri: redirectUri,
    token_access_type: "offline", // Request a refresh token
    ...(state ? { state } : {}),
  });

  return `${DROPBOX_AUTH_URL}?${params.toString()}`;
}

/**
 * Get the current Dropbox connection status from the DB.
 */
export async function getDropboxConnectionStatus(): Promise<{
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  hasRefreshToken: boolean;
  hasStaticToken: boolean;
}> {
  const refreshToken = await readSetting(SETTINGS_KEY_REFRESH_TOKEN);
  const connectedAt = await readSetting(SETTINGS_KEY_CONNECTED_AT);
  const accountEmail = await readSetting(SETTINGS_KEY_ACCOUNT_EMAIL);
  const staticToken = process.env.DROPBOX_ACCESS_TOKEN;

  return {
    connected: !!(refreshToken || staticToken),
    accountEmail,
    connectedAt,
    hasRefreshToken: !!refreshToken,
    hasStaticToken: !!(staticToken && staticToken.trim().length > 0),
  };
}

/**
 * Disconnect Dropbox by removing the stored refresh token.
 */
export async function disconnectDropbox(): Promise<void> {
  tokenCache = null;
  const db = await getDb();
  if (!db) return;
  for (const key of [SETTINGS_KEY_REFRESH_TOKEN, SETTINGS_KEY_CONNECTED_AT, SETTINGS_KEY_ACCOUNT_EMAIL]) {
    await db.delete(appSettings).where(eq(appSettings.key, key));
  }
}
