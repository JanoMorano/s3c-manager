# /catalogue

Zdroj: `frontend/app/catalogue/page.tsx`

## Účel
Přehledový dashboard katalogu služeb. Ukazuje KPI, stav katalogu, pozornost vyžadující služby a rychlé odkazy do operativních pohledů.

## Pole a ovládací prvky
- Stránka nemá editovatelná pole.
- KPI karty zobrazují headline metriky.
- Záložkové odkazy vedou na overview, seznam služeb, operations a capabilities.
- Seznam attention services ukazuje readiness/completeness skóre a odkazuje k doplnění služby.

## Vazby na jiné stránky
- `/services/list` pro plný seznam služeb.
- `/operations` pro provozní cockpit.
- `/capabilities` pro capability coverage.
- Jednotlivé služby typicky vedou na `/services/{service_id}/edit` nebo `/services/{service_id}` podle zdrojového odkazu.

## API a DB vazby
- `GET /api/v1/stats/dashboard-headline`.
- `GET /api/v1/dashboard/inbox`.
- `GET /api/v1/stats/completeness` / operations completeness podle hooků.
- DB: `data.service_catalog`, `service_flavour`, `service_c3_mapping`, `service_role_assignment`, governance/readiness výpočty a referenční tabulky.

## Oprávnění a stav
- Read-only dashboard; zapisuje až editor služby nebo governance stránky.
