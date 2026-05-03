# /c3/capability-map-spiral7

Zdroj: `frontend/app/c3/capability-map-spiral7/page.tsx`, komponenta `CapabilityMapPage`

## Účel
Aktuální C3 Capability Map pro baseline Spiral 7. Slouží jako vizuální katalog domén, L2/L3/L4 capability a jejich mapping stavu.

## Pole a ovládací prvky
- Přepínač spirál podle `/api/v1/taxonomy/spiral`.
- Toggle `show unmapped`.
- Kliknutí na node otevře detailní panel s mapping/completeness informací.
- Pokud je k node připojené `linked_c3_uuid`, panel nabízí otevření C3 detailu.
- Tlačítko v panelu umí filtrovat graf na odpovídající domain/L3.
- Pokud nejsou data, stránka nabízí odkaz do C3 Capability Builderu.

## Vazby na jiné stránky
- `/admin/c3-capability-builder` pro správu builder položek.
- `/c3/{uuid}` pro detail capability.
- `/c3/graph?domain=...&l3=...`.
- Ostatní spirály jako `/c3/capability-map-spiral6`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/capability-map-spiral7`.
- `GET /api/v1/taxonomy/spiral`.
- DB: `c3_capability_builder`, `ref_c3_capability_domain`, `ref_spiral_baseline`, `c3_taxonomy`, `service_c3_mapping`.

## Oprávnění a stav
- Read-only mapa; C3 module musí být aktivní.
