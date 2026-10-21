# Local-first wardrobe maintenance

- This is the public Chinese source edition. Bind to 127.0.0.1:4183. Default data belongs in this checkout's Git-ignored private-data directory. Source publication does not authorize hosting anyone's wardrobe on the internet.
- The website is read-only. Intake and maintenance use the CLI/local API; do not add upload, edit, deletion, runtime AI, cloud sync, account or social UI without a separate request.
- Node 24+ is required. SQLite is authoritative; never write a parallel catalog JSON or page-local relationship mapping.
- Resolve private data with scripts/data-paths.mjs. Keep it out of Git. Read documents.preferences workflowHistory before owner-specific style/intake work. Keep personal preferences, historical receipts and photos out of AGENTS, tests and docs.
- All ordinary writes go through the live service command boundary. Never directly modify the owner DB while the service runs. Check exact current IDs/codes and expected records before mutation.
- Keep IDs and issued aliases permanently reserved, including removed records. Status changes retain ownership/history. Do not infer disposal or removal from low usage.
- Images are immutable files registered with hashes and version metadata. Stage and validate media before committing SQL. An orphan file is not a successful intake. Do not overwrite reviewed bytes.
- Do not infer unverified fabric, brand authenticity, measurements, fit or concealed garment details. Reconstruction requires explicit authorization and honest provenance. Keep inseparable faux layers as one garment. Source originals outside the app must never be deleted.
- Candidate pages are temporary private previews, not formal outfits. Only explicit user selections authorize formal ingestion.
- Preserve assumptions and shopping concepts distinctly from real inventory; do not invent garment records.
- SQL outfit_items owns garment membership; SQL outfit_sources owns derivation. Images and historical parent reservations survive removals. Do not infer links from titles.
- Tests use temporary databases and synthetic geometry, never owner data. Run npm test and npm run check; validate the browser after UI/server changes. Never clear owner browser storage.
- For large migrations: baseline and consistent backup first, migrate/test a copy, verify every record/hash/code, pause writes for final comparison, then cut over. Rollback restores into a new directory and must account for post-cutover edits.
- Never publish a private development checkout or its historical commits. Use an audited source-only export for a public release. Do not rewrite published history without an explicit request.
- Read README and docs/ARCHITECTURE.md for supported commands, boundaries, backup/restore and source export.
- Read docs/AGENT-WORKFLOW.md before photo intake, outfit candidate work, or handing a wardrobe over to another chat. It contains reusable methods only; personal preferences and permissions come from the current wardrobe's private records.
