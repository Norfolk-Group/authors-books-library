import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // neonVector.test.ts is excluded from the main run because loading
    // @neondatabase/serverless in a vitest forks worker causes an OOM crash
    // even with NODE_OPTIONS=--max-old-space-size=4096.
    // Run it standalone: NODE_OPTIONS='--max-old-space-size=4096' npx vitest run server/neonVector.test.ts
    exclude: ["server/neonVector.test.ts"],
    // Use forks pool to isolate each test file in its own process.
    // NODE_OPTIONS=--max-old-space-size=4096 must be set when running tests
    // to prevent OOM crashes in workers that load @google/genai + @neon.
    // The test script in package.json sets this automatically.
    pool: "forks",
  },
});
