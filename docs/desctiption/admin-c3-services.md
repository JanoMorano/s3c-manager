# /admin/c3-services

Zdroj: `frontend/app/admin/c3-services/page.tsx`

## Účel
Admin seznam C3 Services, tedy referenčních C3/FMN služeb mimo hlavní service catalogue.

## Pole a ovládací prvky
- Search filtr a sort.
- Sloupce: `service_code`, `uuid`, `title`, statusová pole, data source, description/source/revised description.
- Edit vede na `/c3/services/{code}/edit`.

## Vazby na jiné stránky
- `/c3/services/{code}`, `/c3/services/{code}/edit`.
- C3 Services mohou být evidence pro capability a TIN.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-services`.
- DB: `data.c3_service`, `c3_capability_c3_service_link`, TIN service links.
