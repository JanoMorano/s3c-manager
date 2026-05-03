# /c3/services/[code]/edit

Zdroj: `frontend/app/c3/services/[code]/edit/page.tsx`

## Účel
Editace C3 Service.

## Pole a ovládací prvky
- Editovatelná pole: `service_code` povinný, `uuid` povinný, `title` povinný, `modification_date`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `data_source`, `external_id`, `data_qualifier`, `source_description`, `revised_description`, `description`, `revised`.

## Vazby na jiné stránky
- Breadcrumb na `/c3/services`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-services/{code}`.
- `PUT /api/v1/taxonomy/c3-services/{id}`.
- DB: `data.c3_service`.

## Validace a oprávnění
- Code, UUID a title jsou povinné.
- Zápis vyžaduje editor/admin.
