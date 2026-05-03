# /services/consolidation-matrix

Zdroj: `frontend/app/services/consolidation-matrix/page.tsx`

## Účel
Matice kandidátů na konsolidaci služeb. Hledá překryv requirement/C3 coverage a přímé závislosti mezi službami.

## Pole a ovládací prvky
- Žádná vstupní pole.
- KPI: compared services, mapped services, review candidates.
- Matice počítá skóre dvojic podle sdílených C3 mappings a vztahů.

## Vazby na jiné stránky
- Služby v matici linkují na `/services/{service_id}`.
- Používá se z grafových a nápovědových stránek jako analytický pohled pro service owners.

## API a DB vazby
- Používá `useGraphOverview`.
- DB: `service_catalog`, `service_relation`, `service_c3_mapping`, `c3_taxonomy`.

## Oprávnění a stav
- Read-only analytický pohled.
