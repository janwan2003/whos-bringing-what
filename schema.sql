-- Who's Bringing What: D1 schema
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL DEFAULT '',
  event_time TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'potluck',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  diet TEXT NOT NULL DEFAULT '',        -- comma list: vegetarian,vegan,gluten-free,dairy-free,nut-allergy
  diet_note TEXT NOT NULL DEFAULT '',   -- free text, e.g. "no shellfish"
  is_host INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS members_ev ON members(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS members_tok ON members(token_hash);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS categories_ev ON categories(event_id);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',       -- what the host asked for, e.g. "Side dish" or "Cranberry sauce"
  is_slot INTEGER NOT NULL DEFAULT 1,   -- 1 = host-made slot (reopens when unclaimed), 0 = guest extra (deleted when unclaimed)
  position INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  dish TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',        -- comma list: vegetarian,vegan,gluten-free,dairy-free,contains-nuts
  claimed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS items_ev ON items(event_id);
CREATE TABLE IF NOT EXISTS rate (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
