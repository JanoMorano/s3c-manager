# /services/impact

Zdroj: `frontend/app/services/impact/page.tsx`

## Účel
Analýza dopadu pro vybranou službu. Ukazuje downstream nebo upstream dopady přes relationship a mapping graf.

## Pole a ovládací prvky
- Service select: výběr zdrojové služby.
- Direction select: `downstream` nebo `upstream`.
- Depth select: hloubka traversal, typicky 1 až 4.
- Run analysis tlačítko spustí/aktivuje analýzu pro aktuální parametry.
- Výstup je rozdělen na impacted services, capabilities a ostatní entity.

## Vazby na jiné stránky
- Impact node služby vede na `/services/{service_id}`.
- Capability nebo C3 entity vedou na odpovídající C3 detail, pokud odpověď obsahuje identifikátor.

## API a DB vazby
- `GET /api/v1/services` pro výběr služby.
- `GET /api/v1/impact/services/{serviceId}?direction=...&depth=...`.
- DB: `service_relation`, `service_catalog`, `service_c3_mapping`, C3 taxonomy/link tabulky.

## Oprávnění a stav
- Read-only analýza; hodnoty se mění pouze ve frontend state/query.
