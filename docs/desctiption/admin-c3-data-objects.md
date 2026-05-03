# /admin/c3-data-objects

Zdroj: `frontend/app/admin/c3-data-objects/page.tsx`

## Účel
Admin seznam C3 Data Objects.

## Pole a ovládací prvky
- Search filtr nad řádky.
- Sort podle sloupců.
- Sloupce: `data_object_code`, `uuid`, `title`, `description`, statusová pole, provenance/references/standards raw.
- Edit akce vede na veřejnou editaci data object detailu.

## Vazby na jiné stránky
- `/c3/data-objects/{code}` a `/c3/data-objects/{code}/edit`.
- Data objects se používají v TIN linkách a capability evidence.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-data-objects`.
- DB: `data.c3_data_object`, `c3_technology_interaction_data_object_link`, `c3_capability_data_object_link`.
