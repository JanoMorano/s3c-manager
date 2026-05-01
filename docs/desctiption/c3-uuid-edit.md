# /c3/[uuid]/edit

Zdroj: `frontend/app/c3/[uuid]/edit/page.tsx`, komponenta `CapabilityDetailPage`

## Účel
Editace jedné C3 taxonomy položky včetně metadata, hierarchy a capability links.

## Pole a ovládací prvky
- Classification/hierarchy: `item_type`, `parent_uuid`.
- Identity: `title` povinný, `application`, `item_status`, `external_id`, `order_num`, `abbreviation`, `synonym`.
- Description: `description`, `source_description`, `revised_description`.
- Source/data quality: `data_qualifier`, `data_source`, `ss_overall_status`, `ss_baseline_status`.
- Links/completeness: přidávání a mazání vazeb na Application, Data Object, TIN a C3 Service; role vazby `supports`, `implements`, `uses`, `depends_on`, `produces`.
- Raw: `script_raw`, `datasets_raw`, `standards_raw`, `references_raw`, `provenance_raw`.

## Vazby na jiné stránky
- Save zůstává na detailu/editaci položky.
- Link panel používá pickery z C3 entity listů a ukazuje odkazy na jejich detaily.
- Service catalogue mappings linkují na `/services/{service_id}`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/{uuid}`.
- `PUT /api/v1/taxonomy/c3/{uuid}`.
- `GET /api/v1/taxonomy/c3/types`, `/statuses`, `/c3` pro selecty.
- Link API: `GET/POST/DELETE /api/v1/taxonomy/c3/{uuid}/links/...`.
- DB: `c3_taxonomy`, C3 capability link tabulky a `service_c3_mapping`.

## Validace a oprávnění
- `title` je povinný.
- UI varuje na chybějící item type/external id a parent u nižších levelů.
- Zápis vyžaduje editor/admin práva.
