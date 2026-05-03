# /admin/installation

Zdroj: `frontend/app/admin/installation/page.tsx`

## Účel
Administrátorský stav instalace, seed demo dat a opravy instalace po prvotním nasazení.

## Pole a ovládací prvky
- Stránka zobrazuje instalační status, summary, moduly, databázový stav a případné chyby.
- Akce `seed demo` volá seed demonstračních dat.
- Akce `repair` spouští opravu instalace a migrací.
- Odkazy do `/install` a `/admin/import`.

## Vazby na jiné stránky
- `/install` pro instalační wizard.
- `/admin/import` pro kontrolu importů po seeding/importu.
- `/administration` přes navigaci administrace.

## API a DB vazby
- `GET /api/v1/install/status`.
- `GET /api/v1/install/summary`.
- `POST /api/v1/install/seed-demo`.
- `POST /api/v1/install/repair`.
- DB: `system_installation`, `schema_migrations`, `module_registry`, `module_installation_history`, `release_metadata`; podle seedovaných dat také katalogové a C3 tabulky.

## Oprávnění a stav
- Určeno pro adminy.
- Operace `repair` a `seed-demo` mění stav databáze a zapisují audit/migration historii.
