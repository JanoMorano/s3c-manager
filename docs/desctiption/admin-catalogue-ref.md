# /admin/catalogue-ref

Zdroj: `frontend/app/admin/catalogue-ref/page.tsx`, komponenta `RefTableEditor`

## Účel
Admin editor katalogových referenčních tabulek.

## Pole a ovládací prvky
- Tabulka se vybírá přes taby: `ref_ServiceType`, `ref_ServiceStatus`, `ref_RelationType`, `ref_PortfolioGroup`, `ref_GlobalServiceGroup`, `ref_ServiceLine`, `ref_OrganizationalElement`, `ref_NetworkDomain`, `ref_SecurityClassification`, `ref_SupportWindow`, `ref_FlavourStatus`, `ref_ServiceRole`, `ref_PaceCategory`.
- Add form se generuje podle metadat sloupců z API.
- Typy polí: pk, text, int, bool checkbox, color input, foreign key select.
- Inline edit a delete pro existující řádky.

## Vazby na jiné stránky
- Tyto číselníky napájí service editor, new service wizard, service list filtry, relationships, SLA a pricing.

## API a DB vazby
- `GET /api/v1/ref/{table}`.
- `POST /api/v1/ref/{table}`.
- `PUT /api/v1/ref/{table}/{code}`.
- `DELETE /api/v1/ref/{table}/{code}`.
- DB: odpovídající `ref_*` tabulky v `backend/db/postgres/schema/02_ref.sql`.

## Oprávnění a stav
- Čtení je dostupnější, zápis vyžaduje `canAdmin`.
