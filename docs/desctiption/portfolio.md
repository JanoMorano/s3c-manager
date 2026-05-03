# /portfolio

Zdroj: `frontend/app/portfolio/page.tsx`

## Účel
Portfolio přehled služeb podle portfolií a owner skupin.

## Pole a ovládací prvky
- Status select: `All statuses` nebo konkrétní status z dat.
- Owner/group search: textové pole filtrující podle owner skupiny nebo názvu.
- KPI: services, active, overdue reviews.
- Portfolio cards ukazují služby, aktivní počet, review stav a vlastníky.

## Vazby na jiné stránky
- Portfolio karta vede na `/services/list?portfolio={portfolio_code}`.
- Navigačně souvisí s `/catalogue` a `/operations`.

## API a DB vazby
- `GET /api/v1/portfolio`.
- DB: `service_portfolio`, `service_catalog`, `service_role_assignment`, `ref_portfolio_group`, governance review data.

## Oprávnění a stav
- Read-only stránka; filtry jsou lokální.
