# /operations/reviews

Zdroj: `frontend/app/operations/reviews/page.tsx`

## Účel
Governance review workflow pro služby.

## Pole a ovládací prvky
- Request Review formulář:
  - `service_id`: povinné.
  - `review_type`: `publish`, `owner_review`, `coverage_review`.
  - `assigned_to`: volitelný email.
  - `due_at`: volitelné datum.
- Review řádky mají akce: Start review, Approve, Reject, Defer.
- KPI: open reviews, in review, overdue.

## Vazby na jiné stránky
- Review řádek vede na `/services/{service_id}`.
- Header linky: `/operations`, `/operations/decisions`.

## API a DB vazby
- `GET /api/v1/governance/reviews?limit=200`.
- `POST /api/v1/governance/reviews`.
- `PATCH /api/v1/governance/reviews/{id}` se statusem `in_review`, `approved`, `rejected`, `deferred`.
- DB: `governance_review`, `service_catalog`.

## Validace a oprávnění
- `service_id` je povinné.
- Server ověřuje existenci služby a práva.
