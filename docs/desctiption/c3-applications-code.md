# /c3/applications/[code]

Zdroj: `frontend/app/c3/applications/[code]/page.tsx`, komponenta `PublicC3EntityDetailPage`

## Účel
Detail C3 Application.

## Pole a ovládací prvky
- Read-only pole: `application_code`, `uuid`, `title`, `description`, `source_description`, `revised_description`, `data_source`, `external_id`, `data_qualifier`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `modification_date`, `revised`.
- Sekce: classification/identification, description, source/status, links a raw hodnoty.

## Vazby na jiné stránky
- Breadcrumb zpět na `/c3/applications`.
- Edit na `/c3/applications/{code}/edit`.
- Navázané TIN/capability linky jsou vidět v souvisejících stránkách.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-applications/{code}`.
- DB: `data.c3_application` a linkovací tabulky.

## Oprávnění a stav
- Read-only detail.
