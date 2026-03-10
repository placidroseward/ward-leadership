import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../../data/db.json");

const DEFAULT_DB = {
  pulseResponses: [],
  agendas: [],
  goals: [],
  sentPulses: [],
};

function readDB() {
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return DEFAULT_DB;
  }
  return JSON.parse(readFileSync(DB_PATH, "utf8"));
}

function writeDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function getAll(collection) {
  const db = readDB();
  return db[collection] || [];
}

export function getById(collection, id) {
  const db = readDB();
  return (db[collection] || []).find((item) => item.id === id);
}

export function insert(collection, item) {
  const db = readDB();
  if (!db[collection]) db[collection] = [];
  db[collection].push(item);
  writeDB(db);
  return item;
}

export function update(collection, id, updates) {
  const db = readDB();
  const idx = (db[collection] || []).findIndex((item) => item.id === id);
  if (idx === -1) return null;
  db[collection][idx] = { ...db[collection][idx], ...updates };
  writeDB(db);
  return db[collection][idx];
}

export function remove(collection, id) {
  const db = readDB();
  db[collection] = (db[collection] || []).filter((item) => item.id !== id);
  writeDB(db);
}

export function upsert(collection, id, item) {
  const existing = getById(collection, id);
  if (existing) return update(collection, id, item);
  return insert(collection, { id, ...item });
}

export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}