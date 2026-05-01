# /administration/users

Zdroj: `frontend/app/administration/users/page.tsx`, API `middleware/src/routes/admin.js`

## Účel
Správa uživatelů aplikace, jejich rolí, typu přihlášení a aktivního stavu.

## Pole a ovládací prvky
- Editor uživatele: `username`, `display_name`, `role`, `auth_provider`, `email`, `department`, `given_name`, `surname`, `external_principal`, `password`, `is_active`.
- Role select: `viewer`, `editor`, `admin`; UI ukazuje i popis přístupových práv.
- Typ přihlášení: `local` nebo `ad`. Pole `external_principal` je aktivní jen pro `ad`; heslo je aktivní jen pro `local`.
- Heslo při založení lokálního účtu musí mít alespoň 8 znaků; při editaci je volitelné.
- Vyhledávání v tabulce uživatelů.
- Řazení podle `username`, `display_name`, `role`, `auth_provider`, `is_active`, `last_login_at`.

## Vazby na jiné stránky
- Breadcrumb zpět na `/administration`.
- Akce Edit načítá řádek do editoru na stejné stránce.

## API a DB vazby
- `GET /api/v1/admin/users` načítá seznam.
- `POST /api/v1/admin/users` zakládá uživatele.
- `PUT /api/v1/admin/users/{id}` upravuje uživatele.
- DB: `platform.users`; změny se auditují do `platform.audit_log`.

## Oprávnění a validace
- Server vyžaduje `canAdmin`.
- Server normalizuje username na lowercase, email na lowercase a kontroluje povinné role/auth_provider.
