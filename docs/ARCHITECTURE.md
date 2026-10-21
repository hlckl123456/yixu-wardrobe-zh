# Runtime data boundary

Browser views → local JSON API → domain validation → one SQLite transaction.

| Entity | Authority | Behavior |
| --- | --- | --- |
| Garment | garments + identities | Metadata JSON, constrained availability, persistent deletion tombstone |
| Outfit | outfits + identities | Descriptive JSON; no duplicate selection, source or image fields |
| Membership | outfit_items | Garment FK, outfit FK, unique slot and garment per outfit |
| Derivation | outfit_sources | Source refers to permanent identity; parent deletion never deletes descendants |
| Images | garment_versions / outfit_visuals + media_assets | Immutable relative paths, SHA-256, explicit version/provenance |
| Notes / old drafts / curation | notes / metadata / formula_preferences | Retained, never used as an alternate active formula engine |
| References / guides / preferences | documents | Validated versioned command snapshots; CK reservations stay in document |
| Command/import receipts | commands / imports | Transactional idempotency and legacy import fingerprints |

An explicitly saved planned outfit has `outfitKind: "planned"` plus validated `suggestedPieces` in its descriptive SQL payload. These unpurchased concepts have no inventory IDs and never enter `outfit_items`; only real owned components receive foreign-key memberships. The separate `upsert-planned-outfit` command preserves this distinction through normalization, snapshots and backups. All outfit views disclose incomplete ownership. Ordinary owned saves continue to reject shopping concepts.

SQLite uses foreign_keys=ON, WAL, busy_timeout, synchronous=FULL and BEGIN IMMEDIATE. Migrations are transactional; a newer schema is rejected. Garment IDs and outfit aliases are never reused. Ordinary commands write only affected rows and increment one revision. State and relationship projections share that revision.

Files cannot join a SQL transaction. Media staging writes/fsyncs a temporary file and publishes it without overwrite. Registration verifies hashes; commands validate registered assets before recording relationships. Failed operations may leave a harmless unregistered file. No automatic orphan deletion is performed. Serving uses an explicit URL registry, realpath containment and a hash check; source archives, preferences, databases and backups are unreachable.

The server projects catalog/reference/thumbnail URLs for browser compatibility. These URLs are not independent writable files. Primary views remain usable if reference parsing fails. Taxonomy, matching, route adaptation, legacy storage reading and view rendering retain separate modules.

The `#mix` browser view derives its eligible pool from the current outfit and garment API projections. It excludes planned looks, missing visuals and unavailable garments, then applies the shared season/style filters. A session-only shuffled queue stores outfit IDs per filter scope; each render resolves them against current records, and membership changes invalidate that scope. No separate relationship mapping, generated outfit or persisted preference is created. Cards and details use the same renderer as My Outfits.

Runtime rendering uses `views/personal.js` with the desktop shell in `workspace.js`/`workspace.css`. Pending discard remains a separate availability view linked from the wardrobe; its overview tab (`#closet?view=overview`) replaces the item grid with non-interactive category and color charts derived by `closet-overview.js` from active catalog records, without persisting analytics. Browser resources refresh through the existing validated catalog resource and local repository. Dialogs resolve current SQL memberships and retain explicit unknown/error states. The independent classic `appearance.js` applies one of four CSS palettes before styling loads and remembers only its theme identifier under `yixu:appearance:v1`; it never writes wardrobe storage or SQL. A blocked storage API falls back to the default palette while session switching remains available.

`workspaceRoute` retires the reference UI and redirects legacy analysis links into the wardrobe overview. The runtime no longer imports reference features or requests reference/guide documents. Historical `baseRoute` and source-link resolution remain separate for CLI validation of stored provenance; removing a browser feature does not rewrite outfit sources or delete private originals. Personal notes remain accessible separately when present.

Tests are deterministic synthetic fixtures. Owner-specific historical regression scripts are kept in private migration archives, not the public test suite. A release export excludes Git, private archives, candidate batches, all photos and deployment metadata. It is not a publication operation.

Limitations: single local user, read-only website, manual CLI maintenance, no authentication/LAN serving, no automatic synchronization or background AI. Runtime SQL snapshots do not themselves copy private processing archives; portable backup copies the registered media set. Restore always targets a new directory to protect newer edits.
