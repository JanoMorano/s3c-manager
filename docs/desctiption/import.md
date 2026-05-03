# /import

Zdroj: `frontend/app/import/page.tsx`

## Účel
Import Review pro běžnější kontrolu importů, preflight kontraktu, stub služeb a posledních C3 importů.

## Pole a ovládací prvky
- Import profile select podle `/api/v1/import/profiles`.
- Checkbox `Jen stuby` filtruje pohled na auto-created stub services.
- Batch list: kliknutí vybere import batch a načte detail.
- Odkazy na export bundle, manifest, import health, upload, governance report, capability coverage a backstage YAML.

## Vazby na jiné stránky
- `/import/upload` pro nový upload.
- `/services/{service_id}` pro stub nebo importovanou službu.
- `/help#data` pro integration mappings.
- C3 import run může odkazovat na admin path pro danou C3 entitu.

## API a DB vazby
- `GET /api/v1/export/manifest?scope=import`.
- `GET /api/v1/import/profiles`.
- `GET /api/v1/import/batches?limit=50`, `GET /api/v1/import/batches/{id}`.
- `GET /api/v1/import/contract-report/latest`.
- `GET /api/v1/import/stubs?limit=50`.
- `GET /api/v1/taxonomy/import-runs/latest`.
- DB: `import_batch`, `import_row`, `import_issue`, `import_contract_report`, `service_catalog`, C3 import run/issue tabulky.

## Oprávnění a stav
- Read-only review; zápis importu je v `/import/upload`.
