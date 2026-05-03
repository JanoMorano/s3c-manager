# /c3/dashboard

Zdroj: `frontend/app/c3/dashboard/page.tsx`

## Účel
Katalogová cesta pro C3 dashboard.

## Pole a ovládací prvky
- Re-exportuje stejnou stránku jako `/admin/c3/dashboard`.
- Pole, taby a grafy jsou shodné s `admin-c3-dashboard.md`.

## Vazby na jiné stránky
- `/c3/list`, `/c3/graph`, export endpoints.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/dashboard`.
- `GET /api/v1/export/manifest?scope=c3`.
- DB vazby jsou shodné s `/admin/c3/dashboard`.
