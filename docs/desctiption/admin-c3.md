# /admin/c3

Zdroj: `frontend/app/admin/c3/page.tsx`

## Účel
Admin list C3 taxonomy položek. Umožňuje filtrovat, řadit, otevírat detail/editaci a mazat položky.

## Pole a ovládací prvky
- URL filtry: `search`, `exact`, `item_type`, `parent`, `status`, `sort`, `dir`.
- Search input filtruje podle textu.
- Checkbox filtry pro item type, status a parent skupiny.
- Type taby nastavují item type filtr.
- Sort tlačítka v tabulce řadí sloupce.
- Delete akce volá smazání C3 položky po potvrzení.

## Vazby na jiné stránky
- Detail: `/c3/{uuid}`.
- Edit: `/c3/{uuid}/edit`.
- Parent odkazy vedou na `/c3/{parent_uuid}`.
- Dashboard a graph jsou navázané přes `/c3/dashboard` a `/c3/graph`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3`.
- `GET /api/v1/taxonomy/c3/parents` pro parent options podle filtru.
- `DELETE /api/v1/taxonomy/c3/{uuid}`.
- DB: `data.c3_taxonomy`, parent vazba `parent_uuid`; vazby na služby přes `service_c3_mapping`.

## Oprávnění a stav
- Admin stránka, zápis/mazání vyžaduje admin/editor práva a aktivní C3 modul.
