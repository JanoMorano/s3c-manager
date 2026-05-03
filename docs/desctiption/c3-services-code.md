# /c3/services/[code]

Zdroj: `frontend/app/c3/services/[code]/page.tsx`

## Účel
Detail C3 Service.

## Pole a ovládací prvky
- Read-only pole: `service_code`, `uuid`, `title`, `description`, `source_description`, `revised_description`, `data_source`, `external_id`, `data_qualifier`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `modification_date`, `revised`.

## Vazby na jiné stránky
- Zpět na `/c3/services`.
- Edit `/c3/services/{code}/edit`.
- Může být linkováno z capability detailu a TIN.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-services/{code}`.
- DB: `data.c3_service`.
