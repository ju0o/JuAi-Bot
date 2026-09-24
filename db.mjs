import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS usage(user_id TEXT, day TEXT, count INTEGER, last_at INTEGER, PRIMARY KEY(user_id, day));
CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS cards(id INTEGER PRIMARY KEY, kind TEXT, payload TEXT, status TEXT DEFAULT 'OPEN', message_id TEXT, remind_at INTEGER, created_at INTEGER);
CREATE TABLE IF NOT EXISTS picks(repo TEXT PRIMARY KEY, day TEXT);
CREATE TABLE IF NOT EXISTS answers(msg_id TEXT PRIMARY KEY, asker TEXT, question TEXT, answer TEXT, url TEXT, model TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS votes(msg_id TEXT, user_id TEXT, vote INTEGER, at INTEGER, PRIMARY KEY(msg_id, user_id));
CREATE TABLE IF NOT EXISTS faq(id INTEGER PRIMARY KEY, source TEXT UNIQUE, question TEXT, answer TEXT, url TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS talk_requests(id INTEGER PRIMARY KEY, user_id TEXT, topic TEXT, at INTEGER, used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS subs(user_id TEXT, keyword TEXT, PRIMARY KEY(user_id, keyword));
CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY, sns TEXT, making TEXT, github TEXT, message_id TEXT, updated_at INTEGER);`;

export function openDb(dir = "data") {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(`${dir}/juai.db`); db.exec("PRAGMA journal_mode=WAL"); db.exec(SCHEMA);
  try { db.exec("ALTER TABLE picks ADD COLUMN msg_id TEXT"); } catch { /* already migrated */ }
  return db;
}
export const kvGet = (db, key) => { const v = db.prepare("SELECT value FROM kv WHERE key=?").get(key)?.value; return v === undefined ? undefined : JSON.parse(v); };
export const kvSet = (db, key, value) => db.prepare("INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, JSON.stringify(value));
