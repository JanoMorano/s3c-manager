# /c3/technology-interactions

Zdroj: `frontend/app/c3/technology-interactions/page.tsx`

## Účel
Katalogový seznam C3 Technology Interactions.

## Pole a ovládací prvky
- Search filtr a sort tabulky.
- Sloupce: TIN code, title, type, maturity, review status, linked services/applications/data objects.
- Edit link pro editor/admin.

## Vazby na jiné stránky
- Detail `/c3/technology-interactions/{code}`.
- Edit `/c3/technology-interactions/{code}/edit`.
- Linked entity odkazují na `/c3/services/{code}`, `/c3/applications/{code}`, `/c3/data-objects/{code}`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-technology-interactions`.
- DB: `data.c3_technology_interaction` a TIN link tabulky.
