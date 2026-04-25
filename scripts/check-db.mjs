import { execFileSync } from "node:child_process";

const output = execFileSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "defense",
    "-d",
    "defense_coach",
    "-tAc",
    "select count(*) from pg_tables where schemaname='public' and tablename in ('Project','FileAsset','ProcessingTask','Artifact','KnowledgeChunk','DefensePracticeTurn'); select extname from pg_extension where extname='vector';",
  ],
  {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  },
).trim();

if (!output.includes("6") || !output.includes("vector")) {
  throw new Error(`Database smoke check failed:\n${output}`);
}

console.log("Database smoke check passed");
