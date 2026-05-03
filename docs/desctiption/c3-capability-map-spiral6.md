# /c3/capability-map-spiral6

Zdroj: `frontend/app/c3/capability-map-spiral6/page.tsx`, komponenta `frontend/app/c3/capability-map/CapabilityMapPage.tsx`

## Účel
Poster/heatmap pohled na C3 Capability Map pro baseline Spiral 6.

## Pole a ovládací prvky
- Přepínač spirál ukazuje dostupné baseline odkazy.
- Toggle `show unmapped` mění zobrazení nenamapovaných položek.
- Kliknutí na capability otevře informační panel.
- Informační panel ukazuje level, domain, mapping stav, L4 potomky, odkazy na C3 detail a graf.

## Vazby na jiné stránky
- `/c3/capability-map-spiral7` a další spirály podle `ref_spiral_baseline`.
- `/c3/{uuid}` pro linked C3 capability.
- `/c3/graph?domain=...&l3=...` pro vztahový graf.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/capability-map-spiral6`.
- `GET /api/v1/taxonomy/spiral`.
- DB: `c3_capability_builder`, `ref_c3_capability_domain`, `ref_spiral_baseline`, C3 taxonomy mapping evidence.

## Oprávnění a stav
- Read-only mapa; editace položek je v `/admin/c3-capability-builder`.
