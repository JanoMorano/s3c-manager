# /

Zdroj: `frontend/app/page.tsx`

## Účel
Domovská stránka aplikace. Slouží jako rozcestník do hlavních oblastí webu podle toho, zda je v instalaci zapnutý modul C3.

## Pole a ovládací prvky
- Stránka nemá formulářová pole.
- Zobrazuje karty s odkazy. Při zapnutém C3 modulu jsou vidět Service Catalogue, C3 Taxonomy a C3 Capability Map. Bez C3 modulu je vidět pouze Service Catalogue.

## Vazby na jiné stránky
- `/catalogue` pro katalog služeb.
- `/c3/dashboard` pro C3 dashboard, pouze když `useInstallStatus().c3Visible` vrací true.
- `/c3/capability-map-spiral7` přes `C3_ROUTES.capabilityMapSpiral7`, pouze při zapnutém C3 modulu.

## API a DB vazby
- Stránka sama nenačítá data z DB.
- Nepřímá vazba je přes `useInstallStatus`, který používá instalační stav a modulový registr, typicky z `/api/v1/install/status` a tabulek `system_installation` / `module_registry`.

## Oprávnění a stav
- Je to klientská stránka v globálním `AppShell`.
- Viditelnost C3 karet je řízena instalačním stavem, ne samostatným filtrem na stránce.
