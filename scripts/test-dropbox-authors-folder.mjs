/**
 * test-dropbox-authors-folder.mjs
 *
 * Tests live Dropbox API access to the Authors Content Entry Folder.
 * Run: node scripts/test-dropbox-authors-folder.mjs
 */

import { createConnection } from "mysql2/promise";

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const DROPBOX_AUTHORS_FOLDER = process.env.DROPBOX_AUTHORS_FOLDER ||
  "/Ricardo Cidale/Apps NAI/RC Library App Data/Authors Content Entry Folder";

if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
  console.error("Missing Dropbox credentials. Ensure DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN are set.");
  process.exit(1);
}

async function getAccessToken() {
  const credentials = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: DROPBOX_REFRESH_TOKEN,
  });

  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token: ${data.error}`);
  return data.access_token;
}

async function listFolder(token, path) {
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, limit: 20 }),
  });

  const data = await res.json();
  if (!res.ok) return { ok: false, status: res.status, error: data };
  return { ok: true, entries: data.entries, hasMore: data.has_more };
}

async function getMetadata(token, path) {
  const res = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });

  const data = await res.json();
  if (!res.ok) return { ok: false, status: res.status, error: data };
  return { ok: true, metadata: data };
}

async function main() {
  console.log("Testing Dropbox Authors Content Entry Folder...\n");
  console.log(`Path: ${DROPBOX_AUTHORS_FOLDER}\n`);

  // Step 1: Get access token
  console.log("1. Refreshing access token...");
  const token = await getAccessToken();
  console.log("   ✅ Token refreshed successfully\n");

  // Step 2: Get folder metadata
  console.log("2. Checking folder metadata...");
  const meta = await getMetadata(token, DROPBOX_AUTHORS_FOLDER);
  if (meta.ok) {
    console.log(`   ✅ Folder exists: ${meta.metadata.name}`);
    console.log(`   Path: ${meta.metadata.path_display}`);
    console.log(`   ID: ${meta.metadata.id}\n`);
  } else {
    console.log(`   ❌ Folder not found (${meta.status}): ${JSON.stringify(meta.error)}`);
    console.log("\n   Trying parent path to debug...");

    // Try the parent
    const parentPath = "/Ricardo Cidale/Apps NAI/RC Library App Data";
    const parentMeta = await getMetadata(token, parentPath);
    if (parentMeta.ok) {
      console.log(`   Parent exists: ${parentMeta.metadata.path_display}`);
      const parentList = await listFolder(token, parentPath);
      if (parentList.ok) {
        console.log(`   Contents of parent folder:`);
        parentList.entries.forEach(e => console.log(`     ${e[".tag"]} ${e.name}`));
      }
    } else {
      // Try without the /Ricardo Cidale prefix
      const altPath = "/Apps NAI/RC Library App Data/Authors Content Entry Folder";
      console.log(`\n   Trying alternate path: ${altPath}`);
      const altMeta = await getMetadata(token, altPath);
      if (altMeta.ok) {
        console.log(`   ✅ Found at alternate path: ${altMeta.metadata.path_display}`);
        console.log(`   → Update DROPBOX_AUTHORS_FOLDER to: ${altPath}`);
      } else {
        console.log(`   ❌ Alternate path also not found`);
        // List root to see what's there
        const rootList = await listFolder(token, "");
        if (rootList.ok) {
          console.log(`\n   Root folder contents:`);
          rootList.entries.forEach(e => console.log(`     ${e[".tag"]} ${e.name}`));
        }
      }
    }
    process.exit(1);
  }

  // Step 3: List folder contents
  console.log("3. Listing folder contents...");
  const list = await listFolder(token, DROPBOX_AUTHORS_FOLDER);
  if (list.ok) {
    if (list.entries.length === 0) {
      console.log("   📭 Folder is empty (ready for files to be dropped in)");
    } else {
      console.log(`   📁 ${list.entries.length} items found${list.hasMore ? " (more available)" : ""}:`);
      list.entries.slice(0, 10).forEach(e => {
        const size = e.size ? ` (${(e.size / 1024).toFixed(1)} KB)` : "";
        console.log(`     ${e[".tag"] === "folder" ? "📁" : "📄"} ${e.name}${size}`);
      });
    }
  } else {
    console.log(`   ❌ Could not list folder: ${JSON.stringify(list.error)}`);
  }

  // Step 4: Check for Processed subfolder
  console.log("\n4. Checking for Processed subfolder...");
  const processedPath = `${DROPBOX_AUTHORS_FOLDER}/Processed`;
  const processedMeta = await getMetadata(token, processedPath);
  if (processedMeta.ok) {
    console.log(`   ✅ Processed subfolder exists`);
  } else {
    console.log(`   ℹ️  Processed subfolder does not exist yet (will be created on first ingest)`);
  }

  console.log("\n✅ Authors Content Entry Folder is accessible and ready.");
  console.log(`\nEnv var: DROPBOX_AUTHORS_FOLDER="${DROPBOX_AUTHORS_FOLDER}"`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
