# /admin/c3/graph

Zdroj: `frontend/app/admin/c3/graph/page.tsx`

## Účel
Admin graf vztahů C3 položek a C3 entity evidence.

## Pole a ovládací prvky
- Search input.
- Item type filtr.
- Přepínač hierarchy/relation view.
- Detail panel vybraného uzlu nebo hrany.
- ReactFlow controls pro pohyb, zoom a fit.

## Vazby na jiné stránky
- Detail node route podle typu: `/c3/{uuid}`, `/c3/applications/{code}`, `/c3/data-objects/{code}`, `/c3/services/{code}`, `/c3/technology-interactions/{code}`.
- Back link na `/c3/list`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3`.
- `GET /api/v1/graph/c3-relations?search=...&item_type=...`.
- DB: `c3_taxonomy`, C3 entity tabulky a C3 link tabulky.

## Oprávnění a stav
- Read-only graf; editace probíhá na detailech.
