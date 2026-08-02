import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use the Supabase "Session pooler" or direct connection string
    // from Project Settings → Database. Never commit the real value.
    url: process.env.DATABASE_URL!,
  },
});
