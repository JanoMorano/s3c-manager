# /management

Zdroj: `frontend/app/management/page.tsx`

## Účel
Content Admin workspace pro zakládání nového obsahu a import dat.

## Pole a ovládací prvky
- Žádná formulářová pole.
- Karty akcí: New Service, Import CSV/JSON/XLSX a při zapnutém C3 také New C3 Capability.

## Vazby na jiné stránky
- `/management/new-service` pro ruční založení služby.
- `/management/new-c3` pro založení C3 capability, pouze při zapnutém C3 modulu.
- `/import/upload` pro hromadný import.

## API a DB vazby
- Nepřímá vazba přes `useInstallStatus`.
- Cílové akce používají `/api/v1/services`, `/api/v1/taxonomy/c3` a importní endpointy.

## Oprávnění a stav
- Stránka je vstup pro editory/content adminy; serverová práva vynucují cílové API.
