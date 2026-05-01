# /operations

Zdroj: `frontend/app/operations/page.tsx`

## Účel
Operations cockpit pro governance, health, pricing, owner load a C3 operational signals.

## Pole a ovládací prvky
- Query `tab`: `governance` výchozí, `health`, `pricing`, `owners`, `c3`.
- Stránka nemá vstupní formulář; pracuje s linky, KPI a panely.
- Governance panely: risk radar, owner load, contract overlap, renewal calendar, advisor findings.
- Health/pricing/owners/C3 taby ukazují odpovídající readiness a completeness výstupy.

## Vazby na jiné stránky
- `/operations/readiness`, `/operations/reviews`, `/operations/decisions`, `/operations/owner-load`.
- `/services/{id}/edit` pro opravu služby.
- `/capabilities/coverage` a C3 detaily pro capability nálezy.

## API a DB vazby
- `/api/v1/dashboard/summary`, `/api/v1/stats/operations`.
- Governance hooky: `/api/v1/governance/risk-radar`, `/owner-load`, `/contract-overlap`, `/renewal-calendar`, `/advisor`.
- DB: `service_catalog`, readiness rules/exceptions, governance findings/reviews/decisions, contracts, role assignments, C3 mappings.

## Oprávnění a stav
- Read-only cockpit; konkrétní workflow zápisy jsou na podstránkách.
