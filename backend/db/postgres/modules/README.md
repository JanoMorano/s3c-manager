# PostgreSQL Module Migrations

This directory is the physical module split for database schema ownership.

The existing `../schema/*.sql` files remain as canonical migration slices for
backwards-compatible bootstrap flows. Each module directory exposes a
`module.sql` entrypoint that includes the owned slices in execution order.

Use `manifest.json` as the authoritative map from application module code to
database slices.
