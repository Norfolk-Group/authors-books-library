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
};
