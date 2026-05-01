# /c3/applications

Zdroj: `frontend/app/c3/applications/page.tsx`, public config `frontend/app/admin/c3-entities/public-config.tsx`

## Účel
Katalogový seznam C3 Applications.

## Pole a ovládací prvky
- Search filtr nad řádky.
- Sort podle sloupců.
- Sloupce: application code, title, status, data source a popis; admin role může vidět UUID.
- Edit link je dostupný pro editor/admin.

## Vazby na jiné stránky
- Detail `/c3/applications/{code}`.
- Edit `/c3/applications/{code}/edit`.
- Vazby z TIN detailů a capability link panelu vedou zpět na tyto detaily.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-applications` nebo kompatibilní list endpoint podle public configu.
- DB: `data.c3_application`, `c3_capability_application_link`, `c3_technology_interaction_application_link`.

## Oprávnění a stav
- List je read-only; editace vyžaduje roli.
