# /login

Zdroj: `frontend/app/login/page.tsx`

## Účel
Přihlášení uživatele lokálním účtem nebo přes SSO, podle zapnutých auth módů.

## Pole a ovládací prvky
- `username`: textové pole pro uživatelské jméno lokálního účtu.
- `password`: heslo lokálního účtu.
- Submit tlačítko volá login a je deaktivované během odesílání.
- Pokud server oznámí SSO režim, stránka zkouší `/api/v1/auth/sso` a může přihlásit uživatele bez zadání hesla.

## Vazby na jiné stránky
- Po úspěšném přihlášení vrací uživatele na parametr `next`, jinak na výchozí stránku aplikace.
- Při chybě zůstává na `/login` a ukáže serverovou hlášku.

## API a DB vazby
- `GET /api/v1/auth/modes` načítá povolené způsoby přihlášení.
- `GET /api/v1/auth/sso` provede trusted-header SSO pokus.
- `POST /api/v1/auth/login` ověřuje lokální účet.
- DB: `platform.users` pro identitu, roli, auth provider a hash hesla; `platform.refresh_tokens` pro session; `platform.app_config` pro SSO nastavení.

## Oprávnění a validace
- Formulář vyžaduje uživatelské jméno a heslo pro lokální login.
- Cookies se posílají přes `credentials: include`.
