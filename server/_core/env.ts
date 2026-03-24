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
  // Google Drive folder IDs (NCG Library structure)
  // Set via environment variables to avoid hardcoding in source
  driveAuthorsFolderId: process.env.DRIVE_AUTHORS_FOLDER_ID ?? "119tuydLrpyvavFEouf3SCq38LAD4_ln5",
  driveBooksAudioFolderId: process.env.DRIVE_BOOKS_AUDIO_FOLDER_ID ?? "1VRHbFqZFWHRhNJYiRlJCnKFBvGUdRBFM",
  driveAvatarsFolderId: process.env.DRIVE_AVATARS_FOLDER_ID ?? "1_sTZD5m4d7Hnb3oBHxRFXONBnFJlJqJF",
  // Feature flags
  enableDriveUpload: process.env.ENABLE_DRIVE_UPLOAD === "true",
};
