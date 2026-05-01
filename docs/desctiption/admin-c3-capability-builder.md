# /admin/c3-capability-builder

Zdroj: `frontend/app/admin/c3-capability-builder/C3CapabilityBuilderPage.tsx`

## Účel
Admin builder pro položky C3 Capability Map a doménovou paletu napříč spiral baseline.

## Pole a ovládací prvky
- Spiral selector: přepíná aktivní `spiralCode`.
- Nová spirála: `newSpiralNumber`, `newSpiralLabel`, tlačítko `Založit mapu`.
- Nastavení mapy: `page_title` pro aktivní spirálu, save tlačítko.
- Tab `Položky builderu`: editor položky `page_id`, `uuid`, `title`, `domain_code`, `state`, `parent_id`, `level`.
- Search v tabulce filtruje pageId, title, parentId, domain, UUID a state.
- Sort v tabulce: page_id, title, level, domain_code, state.
- Tab `Capability Domains` používá generic `RefTableEditor` pro `ref_C3CapabilityDomain`.

## Vazby na jiné stránky
- Otevření mapy aktivní spirály: `/c3/capability-map-spiral{n}`.
- C3 taxonomy link: `/c3/list`.
- Správa domén sdílí číselník s C3 mapou.

## API a DB vazby
- `GET /api/v1/taxonomy/spiral`, `POST /api/v1/taxonomy/spiral`.
- `GET/PUT /api/v1/taxonomy/c3-capability-builder/settings`.
- `GET/POST/PUT/DELETE /api/v1/taxonomy/c3-capability-builder`.
- `GET /api/v1/taxonomy/c3-capability-builder/domains`.
- `GET/POST/PUT/DELETE /api/v1/ref/ref_C3CapabilityDomain`.
- DB: `c3_capability_builder`, `ref_c3_capability_domain`, `ref_spiral_baseline`.

## Validace a oprávnění
- Level má rozsah 1-20.
- Parent select automaticky přebírá domain a zvyšuje level podle parenta.
- Zápis vyžaduje admin/editor oprávnění.
