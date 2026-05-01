# /c3/applications/[code]/edit

Zdroj: `frontend/app/c3/applications/[code]/edit/page.tsx`, komponenta `PublicC3EntityDetailPage`

## Účel
Editace C3 Application.

## Pole a ovládací prvky
- Editovatelná pole: `application_code` povinný, `uuid` povinný, `title` povinný, `modification_date`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `data_source`, `external_id`, `data_qualifier`, `source_description`, `revised_description`, `description`, `revised`.
- Save ukládá celý draft; reset vrací hodnoty z API.

## Vazby na jiné stránky
- Po editaci zůstává na detailu/editaci dané application.
- Breadcrumb/list na `/c3/applications`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-applications/{code}`.
- `PUT /api/v1/taxonomy/c3-application/{id}`.
- DB: `data.c3_application`.

## Validace a oprávnění
- Code, UUID a title jsou povinné.
- Zápis vyžaduje editor/admin roli.
