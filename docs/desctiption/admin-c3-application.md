# /admin/c3-application

Zdroj: `frontend/app/admin/c3-application/page.tsx`, config `frontend/app/admin/c3-entities/config.tsx`

## Účel
Admin seznam C3 Applications importovaných do C3 reference.

## Pole a ovládací prvky
- Search filtr nad všemi hodnotami řádku.
- Sort podle konfigurovaných sloupců.
- Sloupce zahrnují `application_code`, `uuid`, `title`, statusová pole, data source a description summary.
- Edit akce vede na veřejnou editaci application detailu.

## Vazby na jiné stránky
- Detail/edit přes `/c3/applications/{application_code}` a `/c3/applications/{application_code}/edit`.
- Z aplikací mohou vést vazby z TIN a capability link panelu.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-application`.
- DB: `data.c3_application`, linky z `c3_technology_interaction_application_link` a `c3_capability_application_link`.

## Oprávnění a stav
- Admin list; zápis probíhá v detail editaci.
