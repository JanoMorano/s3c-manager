# /search

Zdroj: `frontend/app/search/page.tsx`

## Účel
Globální vyhledávání napříč katalogem a C3 taxonomií.

## Pole a ovládací prvky
- `query`: textové vyhledávací pole typu search.
- Submit zapíše dotaz do URL jako `?query=...`.
- Výsledky se zobrazují jako seznam s typem entity, titulkem, krátkým popisem a odkazem.

## Vazby na jiné stránky
- Výsledky odkazují na detail služby nebo C3 entity podle `href` vráceného API.
- Prázdný dotaz vede zpět na `/search` bez API volání.

## API a DB vazby
- `GET /api/v1/search/global?q=...`.
- DB vazby podle výsledků: `data.service_catalog`, `data.c3_taxonomy`, `data.c3_application`, `data.c3_data_object`, `data.c3_service`, `data.c3_technology_interaction`.

## Oprávnění a stav
- Používá `apiFetch`, takže 401 řeší refresh/redirect na login.
- Vyhledávání se spouští jen pro neprázdný dotaz.
