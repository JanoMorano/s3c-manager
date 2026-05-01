# /administration

Zdroj: `frontend/app/administration/page.tsx`

## Účel
Administrátorský rozcestník pro správu uživatelů, skupin, web/SSO nastavení, číselníků, importů, instalace a audit logů.

## Pole a ovládací prvky
- Žádná formulářová pole.
- Karty jsou rozdělené do sekcí: user management, data management a audit.
- C3 administrační karty se zobrazí jen při zapnutém C3 modulu.

## Vazby na jiné stránky
- `/administration/users`, `/admin/groups`, `/administration/web`.
- `/admin/installation`, `/admin/catalogue-ref`, `/admin/c3-ref`, `/admin/c3-capability-builder`.
- `/import`, `/admin/import`, `/administration/logs`.

## API a DB vazby
- Nepřímá vazba přes `useInstallStatus` na instalační stav a modul C3.
- Přímé CRUD operace probíhají až na cílových stránkách.

## Oprávnění a stav
- Stránka předpokládá administrátorský kontext; konkrétní serverová práva vynucují cílové API endpointy.
