-- StudyCafe Radar — D1 초기 스키마

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  store_name    TEXT NOT NULL,
  naver_place_id TEXT,
  naver_place_url TEXT,
  naver_address TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,           -- YYYY-MM-DD
  weekly_inflow       INTEGER,
  weekly_change_rate  REAL,
  search_rank         INTEGER,
  review_count        INTEGER,
  avg_rating          REAL,
  monthly_visitors    INTEGER,
  my_inflow           INTEGER,
  area_avg_inflow     INTEGER,
  competitor_count    INTEGER,
  percentile          INTEGER,
  radius              TEXT,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_user_date ON kpi_snapshots(user_id, date DESC);
