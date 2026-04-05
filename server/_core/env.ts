export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // External API keys (set via Manus secrets panel)
  apifyApiToken: process.env.APIFY_API_TOKEN ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  replicateApiToken: process.env.REPLICATE_API_TOKEN ?? "",
  tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
  perplexityApiKey: process.env.PERPLEXITY_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
  rapidApiKey: process.env.RAPIDAPI_KEY ?? "",
  twitterBearerToken: process.env.TWITTER_BEARER_TOKEN ?? "",
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY ?? "",
  omdbApiKey: process.env.OMDB_API_KEY ?? "",
  // Google Drive folder IDs (NCG Library structure)
  // Set via environment variables to avoid hardcoding in source
  driveAuthorsFolderId: process.env.DRIVE_AUTHORS_FOLDER_ID ?? "18SjO_Cz6U7hjsSQZwSFVaAA12pL2RQaf",
  driveBooksAudioFolderId: process.env.DRIVE_BOOKS_AUDIO_FOLDER_ID ?? "1-8bnr7xSAYucSFLW75E6DcP712eQ7wMU",
  driveAvatarsFolderId: process.env.DRIVE_AVATARS_FOLDER_ID ?? "1_sTZD5m4dfP4byryghw9XgeDyPnYWNiH",
  // Feature flags
  enableDriveUpload: process.env.ENABLE_DRIVE_UPLOAD === "true",
  // Dropbox credentials (permanent refresh token flow)
  DROPBOX_APP_KEY: process.env.DROPBOX_APP_KEY ?? "",
  DROPBOX_APP_SECRET: process.env.DROPBOX_APP_SECRET ?? "",
  DROPBOX_REFRESH_TOKEN: process.env.DROPBOX_REFRESH_TOKEN ?? "",
  DROPBOX_BACKUP_FOLDER: process.env.DROPBOX_BACKUP_FOLDER ?? "/Cidale Interests/Company/Norfolk AI/Apps/RC Library",
  DROPBOX_INBOX_FOLDER: process.env.DROPBOX_INBOX_FOLDER ?? "/Cidale Interests/Company/Norfolk AI/Apps/RC Library/Inbox",
};
