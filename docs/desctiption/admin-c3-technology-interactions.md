# /admin/c3-technology-interactions

Zdroj: `frontend/app/admin/c3-technology-interactions/page.tsx`

## Účel
Admin seznam C3 Technology Interactions (TIN) včetně vazeb na služby, aplikace a data objects.

## Pole a ovládací prvky
- Search filtr a sort.
- Sloupce: `technology_interaction_code`, `uuid`, `title`, typ/maturity, review statusy, linked services/applications/data objects.
- Edit vede na `/c3/technology-interactions/{code}/edit`.

## Vazby na jiné stránky
- Detail/edit TIN.
- Sloupce s linkovanými entitami vedou na C3 Services, Applications a Data Objects.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-technology-interactions`.
- DB: `data.c3_technology_interaction`, `c3_technology_interaction_service_link`, `c3_technology_interaction_application_link`, `c3_technology_interaction_data_object_link`.
