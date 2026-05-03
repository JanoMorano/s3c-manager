# /operations/decisions

Zdroj: `frontend/app/operations/decisions/page.tsx`

## Účel
Auditovatelný decision log pro governance rozhodnutí služeb.

## Pole a ovládací prvky
- Record Decision formulář:
  - `service_id`: povinné.
  - `decision_type`: `publish_approval`, `deferral`, `risk_acceptance`.
  - `decision`: `approved`, `rejected`, `deferred`, `cancelled`.
  - `rationale`: textarea, povinná pro `rejected` nebo `deferred`.
- KPI: decisions, approved, deferred.

## Vazby na jiné stránky
- Decision řádky vedou na `/services/{service_id}`.
- Header linky: `/operations`, `/operations/reviews`.

## API a DB vazby
- `GET /api/v1/governance/decisions?limit=200`.
- `POST /api/v1/governance/decisions`.
- DB: `governance_decision`, `service_catalog`.

## Validace a oprávnění
- Rejected/deferred rozhodnutí musí mít rationale.
- Zápis vyžaduje governance/edit oprávnění.
