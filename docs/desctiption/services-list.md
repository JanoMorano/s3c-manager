# /services/list

Zdroj: `frontend/app/services/list/page.tsx`

## Účel
Hlavní katalogový seznam služeb s filtrováním, řazením, stránkováním a exportem.

## Pole a ovládací prvky
- `search`: fulltext nad ID, názvem a dalšími textovými poli služby.
- Status multi-filter: `active`, `retired`, `deprecated`, `draft`.
- Portfolio select, service type select, lifecycle multi-filter: `draft`, `under_review`, `approved`, `live`, `deprecated`, `retired`.
- Requestable filtr: všechny / requestable / not requestable.
- Domain chips podle network domain.
- Saved views v `localStorage` pod klíčem `sc_saved_views`.
- Page size: `25`, `50`, `100`, `200`.
- Density: comfortable nebo compact.
- Sort/order a stránkování se promítají do URL a API query.
- Export CSV tlačítko stahuje aktuální dataset.

## Vazby na jiné stránky
- Řádky seznamu vedou na `/services/{service_id}`.
- Edit akce vede na `/services/{service_id}/edit`.
- Grafové a dashboard linky vedou na `/services/graph`, `/services/dependency-flow`, `/services/impact`, `/catalogue`.

## API a DB vazby
- `GET /api/v1/services` s query parametry `search`, `status`, `type`, `portfolio`, `domain`, `lifecycle`, `requestable`, `page`, `limit`, `sort`, `order`.
- `GET /api/v1/services/export/csv`.
- Referenční data přes taxonomy endpoints pro typy, portfolio a domény.
- DB: `data.service_catalog`, `service_available_on`, `ref_service_type`, `ref_service_status`, `ref_portfolio_group`, `ref_network_domain`, `ref_service_lifecycle_stage`.

## Oprávnění a stav
- Read-only seznam; editace je přes detail/editor.
- Používá `apiFetch`, takže auth 401 řeší refresh/redirect.
