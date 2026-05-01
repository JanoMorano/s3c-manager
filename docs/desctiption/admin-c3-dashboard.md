# /admin/c3/dashboard

Zdroj: `frontend/app/admin/c3/dashboard/page.tsx`

## Účel
C3 dashboard pro stav taxonomie, mapování, drift, importy, exporty, health a review queue.

## Pole a ovládací prvky
- URL parametr `tab`, výchozí `overview`.
- KPI: total items, mapped percentage, needs mapping.
- Grafy a coverage lines podle item type, status, spiral coverage a application coverage.
- Kliknutí na grafické položky filtruje `/c3/list?item_type=...` nebo `/c3/list?status=...`.
- Export odkazy: manifest, bundle, hierarchy, C3 relationships.
- Detail/side panel pro vybrané části dashboardu.

## Vazby na jiné stránky
- `/c3/list` s filtry.
- `/c3/graph`.
- `/api/v1/export/manifest`, `/api/v1/export/bundle`, `/api/v1/export/capability-map-hierarchy`, `/api/v1/export/c3-relationships`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/dashboard`.
- `GET /api/v1/export/manifest?scope=c3`.
- DB: `c3_taxonomy`, C3 entity tabulky, C3 link tabulky, `service_c3_mapping`, import run/issues, export metadata.

## Oprávnění a stav
- Read-only dashboard; export linky jsou download/API odkazy.
