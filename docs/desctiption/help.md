# /help

Zdroj: `frontend/app/help/page.tsx`, obsah `frontend/app/help/helpContent.ts`

## Účel
Nápověda a orientace v aplikaci. Popisuje hlavní scénáře, datové oblasti a doporučené workflow.

## Pole a ovládací prvky
- Stránka nemá editovatelná pole ani DB zápis.
- Má interní sekce a karty nápovědy generované z `helpContent.ts`.

## Vazby na jiné stránky
- `/help/service-onboarding` pro průvodce založením a správou služby.
- Odkazy z nápovědových karet vedou například na `/services/list`, `/services/graph`, `/services/consolidation-matrix`, `/import`, `/operations`, `/capabilities`.

## API a DB vazby
- Žádné přímé API volání.
- Všechen text je lokální frontend obsah.

## Oprávnění a stav
- Stránka je součástí aplikace a dědí globální auth/layout pravidla.
