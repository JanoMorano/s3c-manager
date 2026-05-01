# /capabilities/overlaps

Zdroj: `frontend/app/capabilities/overlaps/page.tsx`, komponenta `CapabilityGovernancePage`

## Účel
Pohled na capabilities s duplicitní podporou služeb a kandidáty na konsolidaci.

## Pole a ovládací prvky
- Filter bar: `spiral`, `domain`, `readiness`, volitelně URL `lifecycle` a `owner`.
- Tabulka ukazuje overlap score a recommended action.
- Service chips ukazují mapované služby a readiness stav.

## Vazby na jiné stránky
- `/services/{service_id}` pro dotčené služby.
- `/capabilities/{slug}` nebo `/c3/{uuid}` pro capability detail.
- Souvisí s `/services/consolidation-matrix`.

## API a DB vazby
- `GET /api/v1/capabilities/overlaps`.
- DB: `service_c3_mapping`, `service_catalog`, C3 taxonomy/builder.

## Oprávnění a stav
- Read-only analytický pohled.
