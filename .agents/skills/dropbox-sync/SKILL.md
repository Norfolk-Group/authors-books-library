---
name: dropbox-sync
description: Manage Dropbox folder connections, sync pipelines, and file ingestion for the RC Library app. Use when configuring Dropbox folder paths, debugging the Sync Drive pipeline, adding new folder connections, or understanding the ingest flow from Dropbox to the database.
---

# Dropbox Sync — RC Library App

## Folder Structure (Online Paths)

All folders live under the Ricardo Cidale Dropbox account. The API paths (used in code) differ from the Windows local path display.

| Purpose | API Path | Status |
|---|---|---|
| **Master backup root** | `/Apps NAI/RC Library App Data/Authors and Books Backup` | Active — 115+ author subfolders |
| **Books inbox** | `/Apps NAI/RC Library App Data/Books Content Entry Folder` | Active — new book drops |
| **Authors inbox** | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` | Active — new author drops |
| **Graphics & Design** | `/Apps NAI/RC Library App Data/Graphics and Design` | Reserved — not active |
| **App data root** | `/Apps NAI/RC Library App Data` | Parent folder |

**Windows local path** (for reference only — never use in code):
`C:\Users\ricar\Cidale Dropbox Dropbox\Ricardo Cidale\Apps NAI\RC Library App Data\`

## Environment Variables

| Variable | Value | Purpose |
|---|---|---|
| `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` | Main backup folder |
| `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` | Books content entry |
| `DROPBOX_ACCESS_TOKEN` | (secret) | Short-lived access token |
| `DROPBOX_REFRESH_TOKEN` | (secret) | Long-lived refresh token |
| `DROPBOX_APP_KEY` | (secret) | OAuth app key |
| `DROPBOX_APP_SECRET` | (secret) | OAuth app secret |

## Key Files

```
server/dropbox.service.ts                ← DROPBOX_FOLDERS constant, getDropboxAccessToken, listFolder, downloadFile
server/services/dropboxIngest.service.ts ← ingestDropboxFolder, processDropboxFile
server/routers/dropbox.router.ts         ← tRPC procedures: syncDrive, listFolders, getStatus
server/routers/dropboxConfig.router.ts   ← CRUD for dropbox_folder_configs table
server/dropboxAuth.ts                    ← OAuth token refresh logic
server/dropboxOAuthRoutes.ts             ← /api/dropbox/auth callback handler
```

## Database Table: `dropbox_folder_configs`

Stores all configured folder connections. Managed via the **Dropbox Config** admin page (`/admin` → Media → Dropbox Config).

```ts
// drizzle/schema.ts
export const dropboxFolderConfigs = mysqlTable("dropbox_folder_configs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  folderPath: varchar("folder_path", { length: 500 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // "backup" | "inbox" | "export" | "archive"
  isEnabled: boolean("is_enabled").default(true),
  validationStatus: varchar("validation_status", { length: 50 }).default("pending"), // "valid" | "invalid" | "pending"
  lastValidatedAt: bigint("last_validated_at", { mode: "number" }),
  lastSyncAt: bigint("last_sync_at", { mode: "number" }),
  fileCount: int("file_count").default(0),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
```

## DROPBOX_FOLDERS Constant

The `dropbox.service.ts` file exports a constant with fallback paths. These fallbacks must match the env vars:

```ts
export const DROPBOX_FOLDERS = {
  root: process.env.DROPBOX_BACKUP_FOLDER ?? "/Apps NAI/RC Library App Data/Authors and Books Backup",
  inbox: process.env.DROPBOX_INBOX_FOLDER ?? "/Apps NAI/RC Library App Data/Books Content Entry Folder",
  authorsInbox: "/Apps NAI/RC Library App Data/Authors Content Entry Folder",
  graphicsDesign: "/Apps NAI/RC Library App Data/Graphics and Design",
  appDataRoot: "/Apps NAI/RC Library App Data",
};
```

## Calling the Dropbox API

Always use `getDropboxAccessToken()` — it handles token refresh automatically.

```ts
import { getDropboxAccessToken, DROPBOX_FOLDERS } from "../dropbox.service";

const token = await getDropboxAccessToken();
const response = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ path: DROPBOX_FOLDERS.root, recursive: false }),
});
```

## Validating a Folder Path

Use the `dropboxConfig.validatePath` tRPC procedure to check if a path exists:

```ts
const result = await trpc.dropboxConfig.validatePath.mutate({ folderPath: "/Apps NAI/RC Library App Data/Authors and Books Backup" });
// result: { valid: boolean, fileCount: number, error?: string }
```

## Sync Drive Pipeline

The Sync Drive pipeline (`trpc.dropbox.syncDrive`) polls the inbox folder for new files, downloads them, and routes them to the Smart Upload queue for AI classification.

Trigger manually from Admin → Media → Dropbox Config, or via the Scheduling tab.

## Common Pitfalls

- **Wrong API path format**: Dropbox API paths start with `/` and use forward slashes. The Windows local path (`C:\Users\ricar\...`) is never used in code.
- **Token expiry**: `DROPBOX_ACCESS_TOKEN` expires after ~4 hours. Always call `getDropboxAccessToken()` — it auto-refreshes using `DROPBOX_REFRESH_TOKEN`.
- **Case sensitivity**: Dropbox paths are case-insensitive on the API but case-sensitive in the DB. Use the exact casing from the Dropbox web UI.
- **Google Drive removed**: Google Drive integration was removed in Apr 2026. Do not add any `gws` or `rclone` calls. All cloud storage goes through Dropbox + Manus S3.
