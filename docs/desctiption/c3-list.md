# /c3/list

Zdroj: `frontend/app/c3/list/page.tsx`

## Účel
Veřejnější list C3 taxonomy položek. Sdílí datový model s `/admin/c3`, ale slouží jako katalogový vstup pro čtení a navigaci.

## Pole a ovládací prvky
- Search, exact search, item type/status/parent filtry a řazení podle URL parametrů.
- Tabulka zobrazuje UUID, titul, typ položky, parent, status a metadata podle role.
- Edit tlačítko je viditelné pro uživatele s edit/admin rolí.

## Vazby na jiné stránky
- `/c3/{uuid}` detail položky.
- `/c3/{uuid}/edit` editace.
- Parent odkazy na nadřazené C3 položky.

## API a DB vazby
- `GET /api/v1/taxonomy/c3`.
- DB: `data.c3_taxonomy`, `service_c3_mapping`, případně spirálové membership views.

## Oprávnění a stav
- Čtení je katalogové; editace a mazání zůstává role-based.
