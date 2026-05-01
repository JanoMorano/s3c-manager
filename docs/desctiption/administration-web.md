# /administration/web

Zdroj: `frontend/app/administration/web/page.tsx`, API `middleware/src/routes/admin.js`

## Účel
Správa webového a SSO nastavení aplikace.

## Pole a ovládací prvky
- Nastavení se renderují dynamicky podle metadat z API.
- Boolean nastavení jako checkbox: `auth.sso.enabled`.
- Textová nastavení jako input: `auth.sso.header`, `auth.sso.display_name_header`, `auth.sso.email_header`, `auth.sso.given_name_header`, `auth.sso.surname_header`, `auth.sso.department_header`.
- U každé položky se zobrazuje config key, popis a výchozí hodnota.
- Save tlačítko uloží celý draft najednou.

## Vazby na jiné stránky
- Breadcrumb zpět na `/administration`.
- Nastavení ovlivňuje `/login`, zejména SSO režim a názvy trusted headerů.

## API a DB vazby
- `GET /api/v1/admin/web-settings` načítá SSO konfiguraci.
- `PUT /api/v1/admin/web-settings` ukládá hodnoty.
- DB: `platform.app_config`; server invaliduje config cache po uložení.

## Oprávnění a validace
- Server vyžaduje `canAdmin`.
- Boolean hodnoty se ukládají jako string `true` nebo `false`; prázdná textová hodnota spadne na default.
