# /c3/[uuid]

Zdroj: `frontend/app/c3/[uuid]/page.tsx`, komponenta `frontend/features/c3/components/CapabilityDetailPage.tsx`

## Účel
Detail jedné C3 capability/taxonomy položky.

## Pole a ovládací prvky
- V read-only režimu nejsou editovatelná pole.
- Sekce: classification/hierarchy, identity, description, source/status, links/completeness, raw source fields.
- Capability links panel ukazuje navázané C3 Applications, Data Objects, TIN, C3 Services a service catalogue mappings.

## Vazby na jiné stránky
- Edit odkaz na `/c3/{uuid}/edit`.
- Parent/child odkazy na další `/c3/{uuid}`.
- Link panel odkazuje na `/c3/applications/{code}`, `/c3/data-objects/{code}`, `/c3/services/{code}`, `/c3/technology-interactions/{code}` a `/services/{service_id}`.

## API a DB vazby
- `GET /api/v1/taxonomy/c3/{uuid}`.
- `GET /api/v1/taxonomy/c3/{uuid}/links`.
- DB: `c3_taxonomy`, `c3_capability_application_link`, `c3_capability_data_object_link`, `c3_capability_tin_link`, `c3_capability_c3_service_link`, `service_c3_mapping`.

## Oprávnění a stav
- Detail je read-only; edit akce závisí na roli.
