# /capabilities

Zdroj: `frontend/app/capabilities/page.tsx`

## Účel
Přehled Level 3 capabilities z C3/FMNs pohledu.

## Pole a ovládací prvky
- Žádná vstupní pole.
- KPI: počet L3 capabilities, počet spirál a dashboardů.
- Cards pro capability obsahují titul, doménu/spirálu a stav evidence.
- Tab odkazy: overview, coverage, gaps, overlaps, spirals.

## Vazby na jiné stránky
- Capability karta vede na `/capabilities/{slug}`.
- Governance taby: `/capabilities/coverage`, `/capabilities/gaps`, `/capabilities/overlaps`.
- Spirals přehled: `/spirals`.

## API a DB vazby
- `GET /api/v1/capabilities/lvl3`.
- DB: `c3_taxonomy`, `c3_capability_builder`, `ref_spiral_baseline`, `service_c3_mapping`.

## Oprávnění a stav
- Read-only capability katalog.
