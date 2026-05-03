# /admin/import

Zdroj: `frontend/app/admin/import/page.tsx`

## Účel
Admin import review s detailnější auditní kontrolou batchů, raw relations, raw fields a re-parse pipeline.

## Pole a ovládací prvky
- Import profile select.
- Status filter tlačítka: all/ok/warn/error podle implementace status filtru.
- Taby: Batches, Raw relace (re-parse), Raw Fields per služba.
- Raw fields: input service ID a Load přes `rawFieldsSearch`.
- Raw relations: reparse single row nebo reparse all, s confirm dialogem.
- Pagination load more pro import batches.

## Vazby na jiné stránky
- Breadcrumb `/administration`.
- Export manifest/bundle odkazy.
- Raw field/service odkazy vedou na konkrétní službu, pokud jsou zobrazené v detailu.

## API a DB vazby
- `GET /api/v1/import/review?limit=50&offset=...&status=...`.
- `GET /api/v1/import/batches/{id}`.
- `GET /api/v1/import/relation-raw?parsedOk=0&limit=100`.
- `GET /api/v1/services/{serviceId}/raw-fields`.
- `POST /api/v1/import/reparse-raw`.
- DB: `import_batch`, `import_issue`, `service_relation_raw`, `service_raw_field`, `service_relation`, audit log.

## Oprávnění a stav
- Admin/edit import nástroje; reparse mění vztahová data a audit.
