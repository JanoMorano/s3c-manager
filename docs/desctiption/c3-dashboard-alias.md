# /c3-dashboard

Zdroj: `frontend/app/c3-dashboard/page.tsx`

## Účel
Legacy alias pro C3 Capability Map.

## Pole a ovládací prvky
- Žádná vlastní pole.

## Vazby na jiné stránky
- Re-exportuje stránku `frontend/app/c3/capability-map/page.tsx`.
- Ta dále přesměrovává na aktuální mapu `/c3/capability-map-spiral7`.

## API a DB vazby
- Žádné vlastní API ani DB vazby.
- Data mapy řeší cílová stránka přes `/api/v1/taxonomy/c3/capability-map-spiral7`.
