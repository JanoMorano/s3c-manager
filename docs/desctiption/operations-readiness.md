# /operations/readiness

Zdroj: `frontend/app/operations/readiness/page.tsx`

## Účel
Fronta readiness pravidel pro publikovatelnost služeb. Umožňuje přidávat výjimky k blokujícím pravidlům.

## Pole a ovládací prvky
- Exception panel u failed rule:
  - `reason`: povinný text, max 1000 znaků.
  - `expires_at`: volitelné datum expirace.
- Skupiny: Blockers, Warnings, Ready.
- KPI: total scanned, blockers, ready.

## Vazby na jiné stránky
- Služba v řádku vede na `/services/{service_id}`.
- Header linky: `/operations`, `/services/list`.

## API a DB vazby
- `GET /api/v1/readiness/summary?limit=200`.
- `POST /api/v1/readiness/services/{serviceId}/exceptions`.
- DB: `readiness_rule`, `readiness_exception`, `service_catalog` a odvozené readiness výpočty.

## Validace a oprávnění
- Exception vyžaduje reason.
- Zápis výjimky vyžaduje oprávněného uživatele.
