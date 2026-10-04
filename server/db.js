/**
 * Database layer for enquiry storage.
 *
 * Two drivers, selected by DB_DRIVER:
 *   - "postgres" : production. Connection details come from the environment only.
 *   - "sqlite"   : local development with zero credentials (node:sqlite).
 *
 * Credentials are read exclusively from process.env and never leave the server.
 */
import { readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, "schema.sql");

export const COLUMNS = [
  "arrival_date", "departure_date", "adults", "children", "flexibility",
  "lodge", "transfer", "experiences",
  "full_name", "email", "phone", "country", "notes", "consent",
  "source",
];

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS enquiries (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    arrival_date   TEXT,
    departure_date TEXT,
    adults         INTEGER,
    children       INTEGER,
    flexibility    TEXT,
    lodge          TEXT,
    transfer       TEXT,
    experiences    TEXT,
    full_name      TEXT,
    email          TEXT,
    phone          TEXT,
    country        TEXT,
    notes          TEXT,
    consent        INTEGER NOT NULL DEFAULT 0,
    source         TEXT NOT NULL DEFAULT 'plan-your-stay',
    status         TEXT NOT NULL DEFAULT 'new',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC);
  CREATE INDEX IF NOT EXISTS enquiries_status_idx     ON enquiries (status);
`;

/* ------------------------------------------------------------------ SQLite */
async function createSqlite() {
  const { DatabaseSync } = await import("node:sqlite");
  const path = resolve(process.env.SQLITE_PATH || "./data/enquiries.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SQLITE_DDL);

  const placeholders = COLUMNS.map(() => "?").join(", ");
  const insertSql =
    `INSERT INTO enquiries (${COLUMNS.join(", ")}) VALUES (${placeholders})`;

  return {
    driver: "sqlite",
    location: path,
    async insert(values) {
      const stmt = db.prepare(insertSql);
      const result = stmt.run(...values);
      return Number(result.lastInsertRowid);
    },
    async ping() { db.prepare("SELECT 1").get(); return true; },
    async close() { db.close(); },
  };
}

/* ---------------------------------------------------------------- Postgres */
async function createPostgres() {
  const { default: pg } = await import("pg");
  const useUrl = Boolean(process.env.DATABASE_URL);
  const pool = useUrl
    ? new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
        max: 5,
      })
    : new pg.Pool({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
        max: 5,
      });

  const schema = await readFile(SCHEMA_PATH, "utf8");
  await pool.query(schema);

  const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
  const insertSql =
    `INSERT INTO enquiries (${COLUMNS.join(", ")}) VALUES (${placeholders}) RETURNING id`;

  return {
    driver: "postgres",
    location: useUrl ? "DATABASE_URL" : `${process.env.PGHOST}/${process.env.PGDATABASE}`,
    async insert(values) {
      const { rows } = await pool.query(insertSql, values);
      return rows[0].id;
    },
    async ping() { await pool.query("SELECT 1"); return true; },
    async close() { await pool.end(); },
  };
}

let dbPromise = null;

/** Initialise (once) and return the active database handle. */
export function getDb() {
  if (!dbPromise) {
    const driver = (process.env.DB_DRIVER || "sqlite").toLowerCase();
    dbPromise = driver === "postgres" ? createPostgres() : createSqlite();
  }
  return dbPromise;
}
