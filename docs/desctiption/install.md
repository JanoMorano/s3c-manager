# /install

Zdroj: `frontend/app/install/page.tsx`

## Účel
Prvotní instalační wizard aplikace. Řeší kontrolu stavu, systémovou konfiguraci, databázovou konektivitu, založení prvního admina, aktivaci modulů, volitelný import dat a dokončení instalace.

## Pole a ovládací prvky
- Setup token: heslo/token pro reset nebo chráněné instalační operace.
- Systémová konfigurace: `app_name`, `base_url`, `timezone`, `storage_path`, `https_mode`.
- Admin účet: `username`, `displayName`, `email`, `password`, `confirmPassword`, `mustChangePassword`.
- Moduly: povinný Service Catalogue a volitelný C3 modul (`activateC3`).
- Demo/import: `seedDemoData` checkbox a file input pro nahrání CSV/JSON souborů.
- Wizard má kroky pro start, konfiguraci, DB check, admin bootstrap, moduly/import a execute.

## Vazby na jiné stránky
- Po dokončení a přihlášení směřuje na hlavní aplikaci.
- Importované služby se pak kontrolují v `/import` nebo `/admin/import`.
- Po vytvoření admina používá `/login` API tok.

## API a DB vazby
- `GET /api/v1/install/status`.
- `POST /api/v1/install/reset`, `/start`, `/config`, `/check-db`, `/bootstrap-admin`, `/execute`.
- Po execute může volat `POST /api/v1/auth/login` a importní endpointy jako `/api/v1/import/services/csv`.
- `GET /api/v1/install/summary`.
- DB: `system_installation`, `schema_migrations`, `module_registry`, `module_installation_history`, `release_metadata`, `platform.users`, `platform.app_config` a podle importu `data.service_catalog` / C3 tabulky.

## Oprávnění a validace
- Admin password a confirm password se musí shodovat.
- Lokální admin heslo má serverovou validaci.
- Instalační akce jsou chráněné instalačním stavem a tokenem, aby nešlo přepisovat hotovou instalaci bez kontroly.
