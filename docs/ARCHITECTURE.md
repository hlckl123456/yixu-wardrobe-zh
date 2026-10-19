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

SQLite uses foreign_keys=ON, WAL, busy_timeout, synchronous=FULL and BEGIN IMMEDIATE. Migrations are transactional; a newer schema is rejected. Garment IDs and outfit aliases are never reused. Ordinary commands write only affected rows and increment one revision. State and relationship projections share that revision.

Files cannot join a SQL transaction. Media staging writes/fsyncs a temporary file and publishes it without overwrite. Registration verifies hashes; commands validate registered assets before recording relationships. Failed operations may leave a harmless unregistered file. No automatic orphan deletion is performed. Serving uses an explicit URL registry, realpath containment and a hash check; source archives, preferences, databases and backups are unreachable.

The server projects catalog/reference/thumbnail URLs for browser compatibility. These URLs are not independent writable files. Primary views remain usable if reference parsing fails. Taxonomy, matching, route adaptation, legacy storage reading and view rendering retain separate modules.

Tests are deterministic synthetic fixtures. Owner-specific historical regression scripts are kept in private migration archives, not the public test suite. A release export excludes Git, private archives, candidate batches, all photos and deployment metadata. It is not a publication operation.

Limitations: single local user, read-only website, manual CLI maintenance, no authentication/LAN serving, no automatic synchronization or background AI. Runtime SQL snapshots do not themselves copy private processing archives; portable backup copies the registered media set. Restore always targets a new directory to protect newer edits.
