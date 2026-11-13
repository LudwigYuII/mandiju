(async () => {
  const { createClient } = require("@libsql/client");
  const { upgradeSchema } = require("../lib/schema-upgrades.ts");
  const raw = process.env.MDJ_DB;
  if (!raw) throw new Error("MDJ_DB is required");
  const db = createClient({
    url: /^(file:|libsql:|https:)/.test(raw) ? raw : `file:${raw}`,
    authToken: process.env.MDJ_DB_AUTH_TOKEN,
  });
  try {
    await upgradeSchema(db);
    console.log("Additive schema version 2 is ready.");
  } finally {
    db.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
