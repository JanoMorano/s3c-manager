# /c3/services

Zdroj: `frontend/app/c3/services/page.tsx`

## Účel
Katalogový seznam C3 Services.

## Pole a ovládací prvky
- Search filtr a sort tabulky.
- Sloupce: service code, title, status, source a popis; UUID podle role.
- Edit link pro editor/admin.

## Vazby na jiné stránky
- Detail `/c3/services/{code}`.
- Edit `/c3/services/{code}/edit`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-services`.
- DB: `data.c3_service`, C3 capability/TIN link tabulky.
