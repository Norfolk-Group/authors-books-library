/**
 * verify-dropbox-folders.mjs
 *
 * Deterministic tool: verifies all configured Dropbox folder paths exist and are accessible.
 * Run with: node scripts/verify-dropbox-folders.mjs
 *
 * Exits with code 0 if all folders pass, code 1 if any are missing or inaccessible.
 * Safe to run at any time — read-only, no modifications.
 */
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

// Dropbox token — try refresh token flow first, fall back to access token
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;

if (!DROPBOX_ACCESS_TOKEN && !DROPBOX_REFRESH_TOKEN) {
  console.error("❌ Missing DROPBOX_ACCESS_TOKEN or DROPBOX_REFRESH_TOKEN");
  process.exit(1);
}

// All configured Dropbox folder paths from DROPBOX_FOLDERS constant
const EXPECTED_FOLDERS = [
  {
    key: "DROPBOX_BACKUP_FOLDER",
    path: process.env.DROPBOX_BACKUP_FOLDER || "/Apps NAI/RC Library App Data/Authors and Books Backup",
    description: "Backup destination for author/book JSON exports",
  },
  {
    key: "DROPBOX_INBOX_FOLDER (Books)",
    path: process.env.DROPBOX_INBOX_FOLDER || "/Apps NAI/RC Library App Data/Books Content Entry Folder",
    description: "Drop zone for new book JSON files",
  },
  {
    key: "DROPBOX_AUTHORS_FOLDER",
    path: process.env.DROPBOX_AUTHORS_FOLDER || "/Apps NAI/RC Library App Data/Authors Content Entry Folder",
    description: "Drop zone for new author JSON files",
  },
];

async function getAccessToken() {
  if (DROPBOX_REFRESH_TOKEN && DROPBOX_APP_KEY && DROPBOX_APP_SECRET) {
    const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: DROPBOX_REFRESH_TOKEN,
        client_id: DROPBOX_APP_KEY,
        client_secret: DROPBOX_APP_SECRET,
      }),
    });
    const data = await resp.json();
    if (data.access_token) return data.access_token;
  }
  return DROPBOX_ACCESS_TOKEN;
}

async function checkFolder(token, path) {
  const resp = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  const data = await resp.json();
  if (data[".tag"] === "folder") return { ok: true };
  if (data.error_summary?.includes("not_found")) return { ok: false, reason: "Folder not found" };
  if (data.error_summary?.includes("path/not_folder")) return { ok: false, reason: "Path exists but is a file, not a folder" };
  return { ok: false, reason: data.error_summary || "Unknown error" };
}

async function main() {
  const token = await getAccessToken();
  if (!token) {
    console.error("❌ Could not obtain Dropbox access token");
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const failures = [];

  console.log(`\n📦 Dropbox Folder Verification Report`);

  for (const folder of EXPECTED_FOLDERS) {
    const result = await checkFolder(token, folder.path);
    if (result.ok) {
      console.log(`   ✅ ${folder.key}: ${folder.path}`);
      passed++;
    } else {
      console.log(`   ❌ ${folder.key}: ${folder.path}`);
      console.log(`      Reason: ${result.reason}`);
      failed++;
      failures.push(folder);
    }
  }

  console.log(`\n   Checked: ${EXPECTED_FOLDERS.length} folders`);
  console.log(`   Passed:  ${passed}`);
  console.log(`   Failed:  ${failed}`);

  if (failures.length > 0) {
    console.log(`\n⚠️  Fix: Create the missing folders in Dropbox or update the env vars:`);
    for (const f of failures) {
      console.log(`   ${f.key}="${f.path}"`);
    }
    process.exit(1);
  } else {
    console.log(`\n✅ All Dropbox folders accessible`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
