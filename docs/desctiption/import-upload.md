# /import/upload

Zdroj: `frontend/app/import/upload/page.tsx`

## Účel
Upload a import CSV/JSON/XLSX/XML souborů do Service Catalogue, C3 taxonomy a FMN spiral targets.

## Pole a ovládací prvky
- Spiral baseline selector pro C3/FMN importy; výchozí aktivní baseline z `/api/v1/taxonomy/spiral`.
- Target selector s podporou Service Catalogue S3C, národní CSV, C3 taxonomy, C3 Application, Data Objects, C3 Services, Technology Interactions, Capability Builder a FMN ArchiMate/XLSX targetů.
- Drag and drop / file input pro jeden soubor.
- Preflight dry-run tlačítko, pokud target podporuje dry-run.
- Upload/import tlačítko.
- Download preflight JSON výsledku.

## Podporované endpoint typy
- Service CSV/JSON: `/api/v1/import/services/csv`, `/api/v1/import/services`, dry-run varianty.
- C3 taxonomy/entity CSV/JSON: `/api/v1/taxonomy/{target}/csv`, `/sync`, `/dry-run`.
- XLSX: `/api/v1/taxonomy/c3/xlsx?target_key=...`.
- XML ArchiMate: `/api/v1/taxonomy/c3/{target}/xml-archimate` s `dry_run=true` pro preflight.

## Vazby na jiné stránky
- Import výsledky se kontrolují v `/import` a `/admin/import`.
- C3/FMN importy plní data pro `/c3/list`, C3 entity stránky a capability mapy.

## API a DB vazby
- `GET /api/v1/taxonomy/spiral`.
- Upload endpoint podle targetu.
- DB: podle targetu `service_catalog`, import audit tabulky, `c3_taxonomy`, C3 entity tabulky, `c3_capability_builder`, `ref_spiral_baseline`.

## Validace a oprávnění
- Frontend kontroluje příponu/podporovaný formát podle target configu.
- Zápis vyžaduje editor/admin práva.
