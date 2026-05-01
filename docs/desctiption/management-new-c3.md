# /management/new-c3

Zdroj: `frontend/app/management/new-c3/page.tsx`

## Účel
Wizard pro ruční vytvoření nové položky v C3 taxonomy.

## Pole a kroky
- Basic Identity: `uuid`, `application`, `title` povinný, `description`, `external_id`.
- Hierarchy & Classification: `item_type`, `level_num`, `parent_code`, `parent_uuid`.
- Status & Source: `data_qualifier`, `data_source`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `source_description`, `revised_description`, `abbreviation`, `synonym`.
- Raw Source Fields: `script_raw`, `datasets_raw`, `standards_raw`, `references_raw`, `provenance_raw`.
- Review krok shrnuje payload před uložením.

## Vazby na jiné stránky
- Po uložení přesměruje na `/c3/{uuid}` nebo zpět na `/c3/list`.
- Parent select používá existující C3 položky a tím vytváří stromovou vazbu na nadřazený záznam.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/types`, `/statuses`, `/c3` pro číselníky a parent options.
- `POST /api/v1/taxonomy/c3` vytváří záznam.
- DB: `data.c3_taxonomy`; podle spirál také `data.c3_entity_spiral_membership`.

## Validace a oprávnění
- `title` je povinný; level má omezení 1-9.
- Zápis vyžaduje editor/admin oprávnění a aktivní C3 modul.
