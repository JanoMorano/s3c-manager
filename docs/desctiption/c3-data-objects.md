# /c3/data-objects

Zdroj: `frontend/app/c3/data-objects/page.tsx`

## Účel
Katalogový seznam C3 Data Objects.

## Pole a ovládací prvky
- Search filtr a sort tabulky.
- Sloupce: data object code, title, status, popis a metadata; UUID podle role.
- Edit link pro editor/admin.

## Vazby na jiné stránky
- Detail `/c3/data-objects/{code}`.
- Edit `/c3/data-objects/{code}/edit`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-data-objects`.
- DB: `data.c3_data_object`, capability/TIN linkovací tabulky.
