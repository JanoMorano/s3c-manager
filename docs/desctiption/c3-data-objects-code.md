# /c3/data-objects/[code]

Zdroj: `frontend/app/c3/data-objects/[code]/page.tsx`

## Účel
Detail C3 Data Object.

## Pole a ovládací prvky
- Read-only pole: `data_object_code`, `uuid`, `title`, `description`, `modification_date`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `provenance_raw`, `references_raw`, `standards_raw`.
- Sekce: identifikace, popis, status/source a raw hodnoty.

## Vazby na jiné stránky
- Zpět na `/c3/data-objects`.
- Edit `/c3/data-objects/{code}/edit`.
- Linky z TIN nebo capability detailu mohou vést sem.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-data-objects/{code}`.
- DB: `data.c3_data_object`.
