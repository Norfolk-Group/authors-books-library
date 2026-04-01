/**
 * dropboxOAuthRoutes.ts
 *
 * Express routes for the Dropbox OAuth 2 authorization flow.
 *
 * Routes:
 *   GET /api/dropbox/connect   — Redirects the user to Dropbox's authorization page
 *   GET /api/dropbox/callback  — Exchanges the auth code for tokens, stores refresh token
 *   GET /api/dropbox/status    — Returns connection status (no auth required for polling)
 *   POST /api/dropbox/disconnect — Removes stored refresh token
 */

import type { Express, Request, Response } from "express";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getDropboxConnectionStatus,
  disconnectDropbox,
} from "./dropboxAuth";

export function registerDropboxOAuthRoutes(app: Express): void {
  /**
   * GET /api/dropbox/connect
   *
   * Initiates the OAuth 2 flow. The frontend opens this URL in a new tab/popup.
   * After authorization, Dropbox redirects to /api/dropbox/callback.
   */
  app.get("/api/dropbox/connect", (req: Request, res: Response) => {
    try {
      // Build the redirect URI using the request origin
      const origin = `${req.protocol}://${req.get("host")}`;
      const redirectUri = `${origin}/api/dropbox/callback`;

      const authUrl = getAuthorizationUrl(redirectUri, "ncg-library");
      res.redirect(authUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/dropbox/callback
   *
   * Dropbox redirects here after the user grants access.
   * Exchanges the code for tokens and stores the refresh token in the DB.
   * Redirects the user back to Admin → Sync tab.
   */
  app.get("/api/dropbox/callback", async (req: Request, res: Response) => {
    const { code, error, error_description } = req.query as Record<string, string>;

    if (error) {
      // User denied access or something went wrong
      const msg = error_description ?? error;
      res.redirect(`/admin?tab=sync&dropbox_error=${encodeURIComponent(msg)}`);
      return;
    }

    if (!code) {
      res.redirect("/admin?tab=sync&dropbox_error=No+authorization+code+received");
      return;
    }

    try {
      const origin = `${req.protocol}://${req.get("host")}`;
      const redirectUri = `${origin}/api/dropbox/callback`;

      const { accountEmail } = await exchangeCodeForTokens(code, redirectUri);

      // Redirect back to Admin → Sync with a success indicator
      res.redirect(
        `/admin?tab=sync&dropbox_connected=1&account=${encodeURIComponent(accountEmail)}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Token exchange failed";
      res.redirect(`/admin?tab=sync&dropbox_error=${encodeURIComponent(message)}`);
    }
  });

  /**
   * GET /api/dropbox/status
   *
   * Returns the current Dropbox connection status.
   * Used by the Admin Sync tab to show connection state without polling tRPC.
   */
  app.get("/api/dropbox/status", async (_req: Request, res: Response) => {
    try {
      const status = await getDropboxConnectionStatus();
      res.json(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Status check failed";
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/dropbox/disconnect
   *
   * Removes the stored refresh token and clears the in-memory cache.
   */
  app.post("/api/dropbox/disconnect", async (_req: Request, res: Response) => {
    try {
      await disconnectDropbox();
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Disconnect failed";
      res.status(500).json({ error: message });
    }
  });
}
