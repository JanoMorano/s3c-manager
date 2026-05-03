# /operations/owner-load

Zdroj: `frontend/app/operations/owner-load/page.tsx`

## Účel
Detail zátěže konkrétního vlastníka nebo owner key.

## Pole a ovládací prvky
- Vstup není formulář, používá URL query `owner`.
- Bez `owner` stránka zobrazí prázdný stav.
- KPI: owned services, live services, load score.
- Tabulka role assignments ukazuje službu, roli, status, organization a lifecycle.

## Vazby na jiné stránky
- Role assignment vede na `/services/{service_id}/edit#ownership`.
- Back link na `/operations#governance`.

## API a DB vazby
- `GET /api/v1/governance/owner-load?owner=...&limit=1`.
- `GET /api/v1/governance/owner-load/assignments?owner=...&limit=250`.
- DB: `service_role_assignment`, `service_catalog`, user/owner metadata.

## Oprávnění a stav
- Read-only detail; úprava vlastníků probíhá v service editoru.
