# /admin/c3-ref

Zdroj: `frontend/app/admin/c3-ref/page.tsx`, komponenta `RefTableEditor`

## Účel
Správa C3 referenčních tabulek a přehled inline enumerací.

## Pole a ovládací prvky
- Taby: `ref_C3MappingType`, `ref_C3CapabilityDomain`, C3 entity shortcuty a inline enumerace.
- `RefTableEditor` pro ref tabulky: add form podle metadat, inline edit, delete.
- Typy polí v editoru: primary key read-only při editaci, text input, number input, checkbox, color input, foreign key select.
- Inline enumerace `item_type` a `item_status` jsou pouze informační, protože jsou definované jako DB constraint/hodnoty v backendu.

## Vazby na jiné stránky
- Odkazy na entity listy C3 Applications, Data Objects, Services a Technology Interactions.
- Vazba na `/admin/c3-capability-builder` přes sdílený `ref_C3CapabilityDomain`.

## API a DB vazby
- `GET/POST/PUT/DELETE /api/v1/ref/ref_C3MappingType`.
- `GET/POST/PUT/DELETE /api/v1/ref/ref_C3CapabilityDomain`.
- DB: `ref_c3_mapping_type`, `ref_c3_capability_domain`.

## Oprávnění a stav
- Read ref tabulek je veřejnější, zápis vyžaduje admin práva (`canAdmin`).
