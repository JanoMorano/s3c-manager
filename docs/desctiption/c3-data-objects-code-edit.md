# /c3/data-objects/[code]/edit

Zdroj: `frontend/app/c3/data-objects/[code]/edit/page.tsx`

## Účel
Editace C3 Data Object.

## Pole a ovládací prvky
- Editovatelná pole: `data_object_code` povinný, `uuid` povinný, `title` povinný, `description`, `modification_date`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `provenance_raw`, `references_raw`, `standards_raw`.
- Save ukládá přes ID záznamu; reset vrací načtený stav.

## Vazby na jiné stránky
- Breadcrumb na `/c3/data-objects`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-data-objects/{code}`.
- `PUT /api/v1/taxonomy/c3-data-objects/{id}`.
- DB: `data.c3_data_object`.

## Validace a oprávnění
- Code, UUID a title jsou povinné.
- Zápis vyžaduje editor/admin.
