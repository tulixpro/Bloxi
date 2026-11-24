# Vaylox database

This folder contains the next PostgreSQL schema layer for creator games.

## What is stored here

- `games`: ownership, title, visibility, publication status and current version.
- `game_versions`: immutable version records and JSON manifests.
- `game_assets`: object-storage keys plus content type, size and SHA-256.
- `player_game_saves`: per-player save data with a revision counter.
- `game_play_events`: basic play-event records for later analytics.

## Important storage rule

Do not put uploaded game archives, images, audio, or other large binary files in PostgreSQL or Git. Put those files in an object-storage service and save only the object key and metadata in `game_assets`. Serve public assets through a CDN when the platform grows.

## Apply

The existing app creates its account tables (`users`, `sessions`, and `email_verification_tokens`) at startup. After those tables exist, apply `schema.sql` once to the same PostgreSQL database:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
```

The SQL is intended as a one-time schema migration. Back up the database before applying it to an existing production database.

## Current limitations

This commit adds the database design only. The game publishing API, object-storage uploads, save API, authorization checks, migration runner, and retention/backup policies still need implementation and testing. The current multiplayer/world prototype still keeps world data in server memory. No database server or hosting capacity is created by this SQL file.
