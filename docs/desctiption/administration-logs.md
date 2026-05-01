# /administration/logs

Zdroj: `frontend/app/administration/logs/page.tsx`

## Účel
Auditní log administrátorských a datových akcí.

## Pole a ovládací prvky
- `search`: textové pole pro filtrování zobrazených logů na klientovi.
- Refresh tlačítko znovu načte logy.
- Tabulka ukazuje čas, akci, entitu, uživatele a změněná pole podle odpovědi API.

## Vazby na jiné stránky
- Breadcrumb/odkaz zpět na `/administration`.

## API a DB vazby
- `GET /api/v1/admin/logs`.
- DB: `platform.audit_log`, kam zapisují služby jako user management, import, editace katalogu a governance.

## Oprávnění a stav
- Server vyžaduje admin oprávnění.
- Stránka je read-only; nic nezapisuje.
