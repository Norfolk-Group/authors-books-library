import { Pinecone } from "@pinecone-database/pinecone";

const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) {
  console.error("PINECONE_API_KEY not set");
  process.exit(1);
}

const pc = new Pinecone({ apiKey });

try {
  const { indexes } = await pc.listIndexes();
  console.log("=== PINECONE INDEXES ===");
  if (!indexes || indexes.length === 0) {
    console.log("No indexes found.");
    process.exit(0);
  }
  for (const idx of indexes) {
    console.log(`\nIndex: ${idx.name} | status: ${idx.status?.ready ? "ready" : "not ready"} | dimension: ${idx.dimension}`);
    const index = pc.index(idx.name);
    const stats = await index.describeIndexStats();
    console.log(`  Total vectors: ${stats.totalRecordCount ?? 0}`);
    if (stats.namespaces) {
      for (const [ns, nsStats] of Object.entries(stats.namespaces)) {
        console.log(`  Namespace "${ns}": ${nsStats.recordCount ?? 0} vectors`);
      }
    }
  }
} catch (e) {
  console.error("Error:", e.message);
}
