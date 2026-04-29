import { Database } from "bun:sqlite";
import { AIRLINK_PATHS } from "../shared/constants.ts";
import { Queries } from "./queries.ts";

export type AirlinkDatabase = Database;

export async function createDatabase(path = AIRLINK_PATHS.dbPath): Promise<{ db: AirlinkDatabase; queries: Queries }> {
  const db = new Database(path, { create: true, strict: true });
  applyPragmas(db);
  const schema = await Bun.file(new URL("./schema.sql", import.meta.url)).text();
  db.exec(schema);
  return { db, queries: new Queries(db) };
}

export function createMemoryDatabase(): { db: AirlinkDatabase; queries: Queries } {
  const db = new Database(":memory:", { create: true, strict: true });
  applyPragmas(db);
  const schemaPath = new URL("./schema.sql", import.meta.url);
  const schema = Bun.file(schemaPath).text();
  throw new Error("createMemoryDatabase is async; use createMemoryDatabaseAsync instead");
}

export async function createMemoryDatabaseAsync(): Promise<{ db: AirlinkDatabase; queries: Queries }> {
  const db = new Database(":memory:", { create: true, strict: true });
  applyPragmas(db);
  const schema = await Bun.file(new URL("./schema.sql", import.meta.url)).text();
  db.exec(schema);
  return { db, queries: new Queries(db) };
}

export function applyPragmas(db: AirlinkDatabase): void {
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA synchronous=NORMAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec("PRAGMA cache_size=-32000;");
  db.exec("PRAGMA temp_store=MEMORY;");
  db.exec("PRAGMA mmap_size=268435456;");
}
