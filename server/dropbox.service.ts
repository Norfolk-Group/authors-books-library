/**
 * Dropbox Service
 *
 * Uses the permanent OAuth2 refresh token to always generate a fresh access token.
 *
 * Backup folder root: /Apps NAI/RC Library App Data/Authors and Books Backup
 *   Avatars/      — author headshot images
 *   Book Covers/  — book cover images
 *   PDFs/         — book/resource PDF files
 *
 * Inbox (Books Content Entry): /Apps NAI/RC Library App Data/Books Content Entry Folder
 *   Processed/    — files moved here after successful ingestion
 *
 * Authors Inbox: /Apps NAI/RC Library App Data/Authors Content Entry Folder
 *   Processed/    — files moved here after successful ingestion
 *   (env var: DROPBOX_AUTHORS_FOLDER)
 */

import { ENV } from "./_core/env";
import { safeFetch } from "./_core/ssrfGuard";

const DROPBOX_TOKEN_URL = "https://api.dropbox.com/oauth2/token";
const DROPBOX_API_URL = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_URL = "https://content.dropboxapi.com/2";

const INBOX_ROOT = ENV.DROPBOX_INBOX_FOLDER || "/Apps NAI/RC Library App Data/Books Content Entry Folder";
const BACKUP_ROOT = ENV.DROPBOX_BACKUP_FOLDER || "/Apps NAI/RC Library App Data/Authors and Books Backup";
const AUTHORS_INBOX_ROOT = ENV.DROPBOX_AUTHORS_FOLDER || "/Apps NAI/RC Library App Data/Authors Content Entry Folder";

export const DROPBOX_FOLDERS = {
  root: BACKUP_ROOT,
  avatars: `${BACKUP_ROOT}/Avatars`,
  bookCovers: `${BACKUP_ROOT}/Book Covers`,
  pdfs: `${BACKUP_ROOT}/PDFs`,
  // Books Content Entry Folder — where book-related files are dropped
  inbox: INBOX_ROOT,
  processed: `${INBOX_ROOT}/Processed`,
  // Authors Content Entry Folder — where author files are dropped for ingestion
  authorsInbox: AUTHORS_INBOX_ROOT,
  authorsProcessed: `${AUTHORS_INBOX_ROOT}/Processed`,
};

export type DropboxFolder = keyof typeof DROPBOX_FOLDERS;

/** Exchange the permanent refresh token for a short-lived access token */
export async function getDropboxAccessToken(): Promise<string> {
  const appKey = ENV.DROPBOX_APP_KEY;
  const appSecret = ENV.DROPBOX_APP_SECRET;
  const refreshToken = ENV.DROPBOX_REFRESH_TOKEN;

  if (!appKey || !appSecret || !refreshToken) {
    throw new Error("Dropbox credentials not configured (DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN)");
  }

  const credentials = Buffer.from(`${appKey}:${appSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`Dropbox token refresh returned no access_token: ${data.error}`);
  }

  return data.access_token;
}

export interface DropboxUploadResult {
  path: string;
  name: string;
  size: number;
  id: string;
  serverModified: string;
}

/**
 * Upload a file to Dropbox by URL (downloads from source URL then uploads to Dropbox).
 * @param sourceUrl  Public URL of the file to backup
 * @param destPath   Full Dropbox path e.g. "/Cidale Interests/.../Avatars/adam-grant.jpg"
 * @param overwrite  Whether to overwrite if file already exists (default: true)
 */
export async function uploadFileToDropbox(
  sourceUrl: string,
  destPath: string,
  overwrite = true
): Promise<DropboxUploadResult> {
  const token = await getDropboxAccessToken();

  // Download the file from source URL
  const fileRes = await safeFetch(sourceUrl, undefined, "dropbox.mirrorToDropbox");
  if (!fileRes.ok) {
    throw new Error(`Failed to download source file (${fileRes.status}): ${sourceUrl}`);
  }
  const fileBuffer = await fileRes.arrayBuffer();

  // Upload to Dropbox
  const uploadArgs = JSON.stringify({
    path: destPath,
    mode: overwrite ? "overwrite" : "add",
    autorename: !overwrite,
    mute: true,
  });

  const uploadRes = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": uploadArgs,
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Dropbox upload failed (${uploadRes.status}): ${text}`);
  }

  const result = (await uploadRes.json()) as {
    path_display: string;
    name: string;
    size: number;
    id: string;
    server_modified: string;
  };

  return {
    path: result.path_display,
    name: result.name,
    size: result.size,
    id: result.id,
    serverModified: result.server_modified,
  };
}

/**
 * Download a file from Dropbox and return its raw bytes (ArrayBuffer).
 * Used during ingestion to upload Inbox PDFs to S3.
 */
export async function downloadDropboxFile(dropboxPath: string): Promise<{ buffer: ArrayBuffer; size: number }> {
  const token = await getDropboxAccessToken();
  const downloadArgs = JSON.stringify({ path: dropboxPath });

  const res = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": downloadArgs,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox download failed (${res.status}): ${text}`);
  }

  const buffer = await res.arrayBuffer();
  return { buffer, size: buffer.byteLength };
}

/**
 * Move a file within Dropbox (used to move processed files from Inbox → Inbox/Processed)
 */
export async function moveDropboxFile(fromPath: string, toPath: string): Promise<void> {
  const token = await getDropboxAccessToken();
  const res = await fetch(`${DROPBOX_API_URL}/files/move_v2`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_path: fromPath,
      to_path: toPath,
      autorename: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox move failed (${res.status}): ${text}`);
  }
}

/**
 * Check if a file already exists in Dropbox
 */
export async function dropboxFileExists(path: string): Promise<boolean> {
  const token = await getDropboxAccessToken();
  const res = await fetch(`${DROPBOX_API_URL}/files/get_metadata`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  if (res.status === 409) return false; // path/not_found
  return res.ok;
}

/**
 * List files in a Dropbox folder (returns full path strings)
 */
export async function listDropboxFolder(folderPath: string): Promise<string[]> {
  const token = await getDropboxAccessToken();
  const res = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: folderPath, limit: 2000 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox list_folder failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    entries: Array<{ ".tag": string; name: string; path_display: string }>;
  };

  return data.entries
    .filter((e) => e[".tag"] === "file")
    .map((e) => e.path_display);
}

export interface InboxFile {
  /** Full Dropbox path, e.g. "/Cidale Interests/.../Inbox/Thinking Fast and Slow.pdf" */
  dropboxPath: string;
  /** Just the filename, e.g. "Thinking Fast and Slow.pdf" */
  name: string;
  /** File size in bytes */
  size: number;
  /** Dropbox server modified timestamp */
  serverModified: string;
  /** Derived file extension (lowercase) */
  extension: string;
  /** Whether this is a PDF */
  isPdf: boolean;
}

/**
 * List all files in the Dropbox Inbox folder (excluding the Processed subfolder).
 * Returns rich metadata for each file.
 */
export async function listDropboxInbox(): Promise<InboxFile[]> {
  const token = await getDropboxAccessToken();
  const inboxPath = DROPBOX_FOLDERS.inbox;

  const res = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: inboxPath, limit: 500 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox list_folder (inbox) failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    entries: Array<{
      ".tag": string;
      name: string;
      path_display: string;
      size?: number;
      server_modified?: string;
    }>;
  };

  return data.entries
    .filter(
      (e) =>
        e[".tag"] === "file" &&
        // Exclude files inside the Processed subfolder
        !e.path_display.toLowerCase().includes("/processed/")
    )
    .map((e) => {
      const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
      return {
        dropboxPath: e.path_display,
        name: e.name,
        size: e.size ?? 0,
        serverModified: e.server_modified ?? "",
        extension: ext,
        isPdf: ext === "pdf",
      };
    });
}

/**
 * Get Dropbox account info (useful for health checks)
 */
export async function getDropboxAccountInfo(): Promise<{
  displayName: string;
  email: string;
  accountId: string;
}> {
  const token = await getDropboxAccessToken();
  const res = await fetch(`${DROPBOX_API_URL}/users/get_current_account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "null",
  });

  if (!res.ok) {
    throw new Error(`Dropbox get_current_account failed (${res.status})`);
  }

  const data = (await res.json()) as {
    name: { display_name: string };
    email: string;
    account_id: string;
  };

  return {
    displayName: data.name.display_name,
    email: data.email,
    accountId: data.account_id,
  };
}

/**
 * Derive the Dropbox destination path for a given asset type and filename
 */
export function getDropboxDestPath(
  folder: DropboxFolder,
  filename: string
): string {
  return `${DROPBOX_FOLDERS[folder]}/${filename}`;
}

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
