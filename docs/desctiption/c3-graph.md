# /c3/graph

Zdroj: `frontend/app/c3/graph/page.tsx`

## Účel
Interaktivní vztahový graf C3 taxonomie, capability mapy a C3 entity evidence.

## Pole a ovládací prvky
- Search input.
- Domain/L1 capability tlačítka a L3 select podle capability map Spiral 7.
- Přepínače typů uzlů pro capability, application, data object, TIN a C3 service.
- Edge type straight/smoothstep, line style a PDF export.
- Detail panel vybraného uzlu/hrany.

## Vazby na jiné stránky
- Node linky: `/c3/{uuid}`, `/c3/applications/{code}`, `/c3/data-objects/{code}`, `/c3/services/{code}`, `/c3/technology-interactions/{code}`.
- Capability map detail může otevřít graf s parametry `domain` a `l3`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/capability-map-spiral7` pro domain/L3 filtry.
- `GET /api/v1/graph/c3-relations?search=...&domain_code=...&l3_page_id=...`.
- DB: `c3_taxonomy`, `c3_capability_builder`, C3 entity tabulky, C3 link tabulky a service mappings.

## Oprávnění a stav
- Read-only graf; změny vazeb se dělají v editaci capability.
