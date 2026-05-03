# /capabilities/coverage

Zdroj: `frontend/app/capabilities/coverage/page.tsx`, komponenta `CapabilityGovernancePage`

## Účel
Coverage matrix napříč C3 capabilities, službami, readiness a FMN spiral evidence.

## Pole a ovládací prvky
- Filter form: `spiral` select (`All`, `Spiral_7`, `Spiral_6`, `Spiral_5`, `Spiral_4`), `domain` search, `readiness` select (`All`, `ready`, `blocked`).
- Query podporuje i `lifecycle` a `owner`, pokud jsou přítomné v URL.
- KPI: total, not ready, over-covered.
- Tabulka: capability, spiral, coverage progress, mapped services, readiness badge.

## Vazby na jiné stránky
- Capability link vede na `/capabilities/{slug}` nebo `/c3/{uuid}`.
- Service chips vedou na `/services/{service_id}`.
- Taby na `/capabilities/gaps` a `/capabilities/overlaps`.

## API a DB vazby
- `GET /api/v1/capabilities/coverage?spiral=...&domain=...&lifecycle=...&owner=...&readiness=...`.
- DB: C3 taxonomy/builder, service mappings, service catalogue a readiness výpočty.

## Oprávnění a stav
- Read-only governance pohled.
