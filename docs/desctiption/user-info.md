# /user-info

Zdroj: `frontend/app/user-info/page.tsx`

## Účel
Osobní profil přihlášeného uživatele, preference UI, změna hesla, session informace a seznam služeb vlastněných uživatelem.

## Pole a ovládací prvky
- Profil: `given_name`, `surname`, `display_name`, `email`, `department`, `phone`.
- Jazyk: `preferred_lang` select s možnostmi `cs`, `en`, `sk`, `de`; změna volá preference a ovlivňuje i i18n kontext.
- Persona: select `consumer`, `service_owner`, `admin`; ukládá se jako preference pro personalizaci UI.
- Změna hesla: `current`, `next`, `confirm`; nové heslo a potvrzení se musí shodovat.
- Přepínač session detailu ukazuje technické informace o přihlášení.
- Logout tlačítko odhlásí uživatele.

## Vazby na jiné stránky
- Při chybě načtení vede odkaz na `/login`.
- Seznam vlastněných služeb linkuje na `/services/{service_id}`.

## API a DB vazby
- `GET /api/v1/auth/me` načítá profil a session.
- `PATCH /api/v1/auth/me` ukládá profilová pole.
- `PATCH /api/v1/auth/preferences` ukládá jazyk/personu.
- `POST /api/v1/auth/change-password` mění lokální heslo.
- `POST /api/v1/auth/logout` ruší session.
- `GET /api/v1/services?owner=...&limit=100` načítá vlastněné služby.
- DB: `platform.users`, `platform.refresh_tokens`, nepřímo `data.service_catalog` a `data.service_role_assignment`.

## Oprávnění a validace
- Vyžaduje přihlášení.
- Heslo lze měnit jen pro lokální účet; SSO účty jsou řízené externím providerem.
