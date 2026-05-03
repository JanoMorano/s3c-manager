# /services/dependency-flow

Zdroj: `frontend/app/services/dependency-flow/page.tsx`

## Účel
Rozhodovací pohled na tok závislostí: consumer need, business/service catalogue node, enabling services, C3 capability a C3 requirement evidence.

## Pole a ovládací prvky
- Stránka nemá formulářová pole.
- Ukazuje KPI: počet služeb, dependencies, C3 mappings.
- Vizualizuje sloupce s top službami, závislostmi a capability evidence.

## Vazby na jiné stránky
- Service cards linkují na `/services/{service_id}`.
- Capability cards linkují na `/c3/{uuid}`.
- Požadavkové entity linkují na příslušné C3 detaily, pokud mají známý href.

## API a DB vazby
- Používá globální graph overview přes `useGraphOverview`.
- DB: `service_catalog`, `service_relation`, `service_c3_mapping`, `c3_taxonomy` a navázané C3 entity.

## Oprávnění a stav
- Read-only decision view.
