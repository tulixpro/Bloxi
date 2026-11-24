-- Vaylox database foundation (PostgreSQL)
-- Run after the existing server has initialized users/sessions.
-- Large game files are NOT stored in PostgreSQL: store them in object storage
-- and keep only object keys, sizes, hashes, and metadata here.

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  visibility VARCHAR(16) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','unlisted','public')),
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived','blocked')),
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, slug)
);

CREATE INDEX IF NOT EXISTS games_public_discovery_idx
  ON games(updated_at DESC) WHERE visibility='public' AND status='published';
CREATE INDEX IF NOT EXISTS games_owner_updated_idx
  ON games(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS game_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, version_number),
  UNIQUE(game_id, id)
);

ALTER TABLE games
  ADD CONSTRAINT games_current_version_fk
  FOREIGN KEY (id, current_version_id)
  REFERENCES game_versions(game_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS game_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES game_versions(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(version_id, object_key)
);
CREATE INDEX IF NOT EXISTS game_assets_version_idx ON game_assets(version_id);

CREATE TABLE IF NOT EXISTS player_game_saves (
  player_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  save_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(player_id, game_id)
);
CREATE INDEX IF NOT EXISTS player_game_saves_game_updated_idx
  ON player_game_saves(game_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS game_play_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS game_play_events_game_time_idx
  ON game_play_events(game_id, played_at DESC);

-- Keep the game's current version tied to a version belonging to that game.
-- The composite FK is intentionally deferred so a new game and first version
-- can be created in one transaction.
