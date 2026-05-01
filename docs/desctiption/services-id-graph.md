# /services/[id]/graph

Zdroj: `frontend/app/services/[id]/graph/page.tsx`

## Účel
Interaktivní graf jedné služby a jejího okolí: závislosti, flavours, C3 capability a navázané C3 entity.

## Pole a ovládací prvky
- Service picker pro přepnutí na jinou službu.
- Depth ovládání `1`, `2`, `3`.
- Edge type: straight nebo smoothstep.
- Line style: auto, solid, dashed.
- PDF export grafu.
- Detail panel pro vybraný node nebo edge.
- Double-click/link routing na odpovídající detail entity.

## Vazby na jiné stránky
- Service node odkazuje na `/services/{service_id}`.
- C3 capability na `/c3/{uuid}`.
- C3 Application na `/c3/applications/{code}`.
- TIN na `/c3/technology-interactions/{code}`.
- Data Object na `/c3/data-objects/{code}`.
- C3 Service na `/c3/services/{code}`.

## API a DB vazby
- `GET /api/v1/services/{id}/graph?depth={n}&mode=v2`.
- Pro picker se používá `/api/v1/services`.
- DB: `service_relation`, `service_flavour`, `service_c3_mapping`, `c3_taxonomy`, `c3_application`, `c3_data_object`, `c3_service`, `c3_technology_interaction` a linkovací C3 tabulky.

## Oprávnění a stav
- Read-only vizualizace; data nemění.
