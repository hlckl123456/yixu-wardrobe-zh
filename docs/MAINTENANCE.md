# Maintenance and Data Boundaries

Node.js 24+ · SQLite · plain browser modules · loopback only.

## Run

```sh
npm start
npm run status
npm stop
```

Open http://127.0.0.1:4183. There are no runtime npm dependencies. macOS launchers also accept `YIXU_NODE_BIN`; a normal Node 24+ installation is sufficient. The optional thumbnail command uses a separately installed `sharp`.

The website is a read-only wardrobe and outfit browser. Maintenance/intake uses the local API and CLI; it does not require an AI runtime to browse.

## Private data is not application source

Default directory: `private-data/` inside this checkout, ignored by Git.

Override with an absolute `YIXU_DATA_DIR`. Its `wardrobe.sqlite` is the only mutable source of inventory, formal outfits, memberships, stable aliases, image versions, editorial content and preferences. Files live in `public/`, but that directory is **not** exposed as a static root: only exact database-registered URLs can be served. Backups, history and raw processing inputs are never served.

`dist/data/catalog.json`, reference modules and the thumbnail module returned over HTTP are database projections, not editable data files. Website browsing has no independent garment-to-outfit mappings.

Personal workflow history is stored in the private database's `documents` row `preferences`. Read it for owner-specific intake/style decisions; do not put that history back into source instructions.

## Empty and synthetic-demo installs

An empty database starts without owner files. For a clearly marked geometric example:

```sh
node scripts/demo.mjs /absolute/new/demo-directory
YIXU_DATA_DIR=/absolute/new/demo-directory node scripts/local.mjs start 4193
YIXU_DATA_DIR=/absolute/new/demo-directory node scripts/local.mjs stop 4193
```

Never point tests at the owner's data or origin. `npm test` uses temporary synthetic records. `npm run preview` uses a temporary empty database on 4173.

## Maintenance

Set `YIXU_ORIGIN` when using a non-default server. Media operations require `YIXU_DATA_DIR` to match that server.

- `node scripts/lookup-codes.mjs SY01 DP01`: read current identifiers.
- `node scripts/intake.mjs /absolute/reviewed-manifest.json`: validate a reviewed cutout, deduplicate source hashes, stage immutable media, and commit the garment. Required manifest fields: collection=owned, name, layer, subtype, color{name,family,hex}, fit, pattern, styles[], seasons[], uncertainties[], originalPath, cutoutPath, processingMethod, review{approved,notes}. AI reconstruction additionally requires review.reconstructionAuthorized and its explicit user authorization. Optional original HEIC sourcePath is hashed, not copied. Multiple garments in one source need stable sourceItemKey.
- `node scripts/set-garment-status.mjs pending-discard SY01`: availability, not physical disposal. `active` restores availability.
- `node scripts/register-media.mjs /absolute/reviewed.png assets/outfits/versioned-name.png`: register immutable reviewed output before saving a look.
- `node scripts/save-owned-outfit.mjs /absolute/look.json`: full stable record, exact garment IDs/codes, optional visual/assumedBasics/source link; validates and snapshots before commit.
- `node scripts/remove-owned-outfits.mjs DP01`: explicit exact-record removal. Garments/media and all code reservations remain.
- The `remove-garments` API command requires full expected garment records; if used, it requires the exact full `relatedOutfits` impact set. Both removals commit together. No implicit broad cascade.
- For a garment image update, use `upsert-garment` with full expected record, new registered asset, and the previous image version retained in imageHistory.
- `node scripts/check.mjs --data-dir /absolute/private-directory`: integrity, foreign keys, all media hashes, current alpha.

Snapshots before each mutation retain all SQL tables. Files are immutable and are not part of a SQL transaction; failed intake can leave an unregistered file, never a visible phantom record. Such orphan files are retained for inspection, not automatically deleted.

## Backup / restore

```sh
node scripts/backup-private.mjs /absolute/new/backup-directory
node scripts/restore-private.mjs /absolute/backup-directory /absolute/new/restored-directory
```

The backup is a consistent SQLite copy plus every registered media file, with hashes verified. Restoration **only writes a new directory**. It cannot overwrite edits made after the backup. Inspect the restored copy; stop the current server; explicitly switch `YIXU_DATA_DIR` to it. Keep the current data directory until all later edits have been accounted for. Private non-runtime history/processing archives should additionally be backed up with normal filesystem backups.

For v1 migration, stop writes, retain an online SQLite backup and the entire checkout, then run:
`node scripts/migrate-private-data.mjs /absolute/old-checkout /absolute/new-private-directory /absolute/consistent-v1.sqlite`.
It compares records, tables, aliases, image bytes and relationships; it never deletes the source and refuses an existing destination. Never reopen a v2 file in the v1 implementation.

## Architecture

See [architecture](docs/ARCHITECTURE.md). Core constraints live in SQLite, business validation in pure modules, commands in one server transaction. Legacy browser imports preserve raw bytes first; unknown garment references fail safely, not fabricated inventory. Browser localStorage is a migration source only and is never erased.

## Source-only exports

`node scripts/export-source.mjs /absolute/new/source-export` copies an allowlisted source tree without Git, data, images, local history or deployment identities. Review the result before publishing. Never publish the history of a private development checkout; older commits can retain deleted photos and databases. This public repository started with a new, source-only history.
