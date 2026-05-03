# /capabilities/[slug]

Zdroj: `frontend/app/capabilities/[slug]/page.tsx`

## Účel
Detail capability coverage pro konkrétní capability slug a vybranou spirálu.

## Pole a ovládací prvky
- Query `spiral`, výchozí typicky `Spiral_7`.
- Query `tab` přepíná sekce: `overview`, `requirements`, `services`, `overlap`, `documents`, `gaps`.
- Spiral pills umožňují přepínat Spiral 4 až 7.
- Coverage donut/progress a KPI pro requirements, covered count a gaps.

## Vazby na jiné stránky
- `/spirals/{spiral}?tab=fulfillment` pro fulfillment plán.
- Mapped služby linkují na `/services/{service_id}`.
- Souvisí s `/capabilities/coverage`, `/capabilities/gaps`, `/capabilities/overlaps`.

## API a DB vazby
- `GET /api/v1/capabilities/by-slug/{slug}/coverage?spiral={spiral}`.
- DB: `c3_taxonomy`, `c3_capability_builder`, `service_c3_mapping`, `service_catalog`, importované requirement evidence.

## Oprávnění a stav
- Read-only analytický detail.
