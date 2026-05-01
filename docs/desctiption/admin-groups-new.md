# /admin/groups/new

Zdroj: `frontend/app/admin/groups/new/page.tsx`

## Účel
Založení nové RBAC skupiny.

## Pole a ovládací prvky
- `groupName`: název skupiny; při psaní generuje výchozí code.
- `groupCode`: kód skupiny, normalizovaný pro použití v DB.
- `description`: volitelný popis.
- Submit vytvoří skupinu; Cancel vede zpět na seznam.

## Vazby na jiné stránky
- Po vytvoření přesměruje na `/admin/groups/{id}`.
- Cancel/back na `/admin/groups`.

## API a DB vazby
- `POST /api/v1/admin/groups` s `group_code`, `group_name`, `description`.
- DB: `app_group`.

## Validace a oprávnění
- Název a kód jsou prakticky povinné pro úspěšný zápis.
- Server vyžaduje admin oprávnění.
