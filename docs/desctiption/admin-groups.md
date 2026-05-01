# /admin/groups

Zdroj: `frontend/app/admin/groups/page.tsx`

## Účel
Seznam aplikačních skupin pro RBAC.

## Pole a ovládací prvky
- Žádná vstupní pole.
- New Group odkaz.
- Tabulka/karty skupin ukazují code, name, description, active stav, počet členů a akce.
- Delete akce maže skupinu po volání API.

## Vazby na jiné stránky
- `/admin/groups/new` pro založení.
- `/admin/groups/{id}` pro detail, permissions a members.

## API a DB vazby
- `GET /api/v1/admin/groups`.
- `DELETE /api/v1/admin/groups/{id}`.
- DB: `app_group`, `app_group_permission`, `app_user_group`.

## Oprávnění a stav
- Server vyžaduje admin oprávnění.
