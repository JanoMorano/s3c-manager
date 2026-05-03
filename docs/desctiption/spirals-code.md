# /spirals/[code]

Zdroj: `frontend/app/spirals/[code]/page.tsx`

## Účel
Detail jedné spirály s heatmapou a fulfillment plánem.

## Pole a ovládací prvky
- Query `tab`: výchozí `heatmap`, nebo `fulfillment`.
- Tab linky přepínají Heatmap a Fulfillment Plan.
- Heatmap ukazuje coverage a top gaps.
- Fulfillment načítá plán jen pro aktivní tab.

## Vazby na jiné stránky
- Gaps linkují na `/capabilities/{slug}?spiral={code}`.
- Fulfillment plán je propojený s capability coverage.

## API a DB vazby
- `GET /api/v1/spirals/{code}/heatmap`.
- `GET /api/v1/spirals/{code}/fulfillment-plan`.
- DB: `ref_spiral_baseline`, `c3_capability_builder`, `service_c3_mapping`, capability coverage views.

## Oprávnění a stav
- Read-only analytický detail.
