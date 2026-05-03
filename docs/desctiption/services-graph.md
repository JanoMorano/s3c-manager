# /services/graph

Zdroj: `frontend/app/services/graph/page.tsx`

## Účel
Globální interaktivní graf katalogu služeb, závislostí, C3 mappings, C3 entity evidence a volitelně flavours.

## Pole a ovládací prvky
- Search: hledá služby a C3 uzly.
- Status, portfolio a service type select.
- Relation type chips: `depends_on`, `prerequisite`, `underlying`, `replaces`, `related_to`, `provided_by`.
- Domain chips podle network domains.
- Edge type straight/smoothstep a line style auto/solid/dashed.
- Checkboxy: show C3, show flavours, show edge labels, compact payload, minimap.
- Save layout ukládá pozice uzlů.
- PDF export grafu.
- Detail panel pro službu, C3 entitu nebo edge.

## Vazby na jiné stránky
- Grafové záložky vedou na `/services/graph`, `/services/dependency-flow`, `/services/consolidation-matrix`, `/services/impact`.
- Detail panel linkuje na `/services/{id}`, `/c3/{uuid}`, `/c3/applications/{code}`, `/c3/technology-interactions/{code}`, `/c3/data-objects/{code}`, `/c3/services/{code}`.

## API a DB vazby
- `GET /api/v1/graph/overview` nebo compact varianta přes `buildGraphOverviewUrl`.
- `GET /api/v1/flavours?all=1` při zapnutí flavour nodes.
- `GET /api/v1/taxonomy/domains` pro domény.
- `POST /api/v1/graph/overview/layout` ukládá layout.
- DB: `service_catalog`, `service_relation`, `service_flavour`, `service_c3_mapping`, C3 entity tabulky, C3 link tabulky, `graph_layout_audit`.

## Oprávnění a stav
- Vizualizace je read-only kromě ukládání layoutu.
- C3 přepínač se automaticky vypíná, když instalace nemá aktivní C3 modul.
