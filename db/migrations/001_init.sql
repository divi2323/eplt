BEGIN;

CREATE TABLE IF NOT EXISTS people (
  person_id      TEXT PRIMARY KEY,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leagues (
  league_id      TEXT PRIMARY KEY,
  league_name    TEXT NOT NULL,
  is_archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  event_id       TEXT PRIMARY KEY,
  league_id      TEXT NOT NULL REFERENCES leagues(league_id) ON DELETE RESTRICT,
  event_name     TEXT NOT NULL,
  event_date     DATE NOT NULL,
  venue_name     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entries (
  entry_id       TEXT PRIMARY KEY,
  event_id       TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  person_id      TEXT NOT NULL REFERENCES people(person_id) ON DELETE RESTRICT,
  buyins         INTEGER NOT NULL DEFAULT 1 CHECK (buyins >= 0),
  points         INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  cash_out       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, person_id)
);

COMMIT;
