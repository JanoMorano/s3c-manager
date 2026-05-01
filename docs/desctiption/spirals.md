# /spirals

Zdroj: `frontend/app/spirals/page.tsx`

## Účel
Přehled FMN/C3 spiral baseline.

## Pole a ovládací prvky
- Žádná vstupní pole.
- KPI: total spirals, active baseline, heatmaps.
- Cards/list spirál s odkazem na detail.

## Vazby na jiné stránky
- `/spirals/{code}` pro heatmap a fulfillment detail spirály.
- `/capabilities` a capability governance používají stejné spiral kódy.

## API a DB vazby
- `GET /api/v1/spirals`.
- DB: `ref_spiral_baseline`, C3 membership/builder data.

## Oprávnění a stav
- Read-only přehled.
