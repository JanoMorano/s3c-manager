# /services/[id]/history

Zdroj: `frontend/app/services/[id]/history/page.tsx`

## Účel
Auditní historie konkrétní služby.

## Pole a ovládací prvky
- Žádná editovatelná pole.
- Timeline/tabulka ukazuje akci, čas, uživatele, změněná pole, staré a nové hodnoty.

## Vazby na jiné stránky
- Odkaz zpět na `/services/{id}`.
- Typicky dostupné také z detailu služby a editoru.

## API a DB vazby
- `GET /api/v1/services/{id}/history`.
- DB: `platform.audit_log`; auditované změny vznikají při editaci služby, roles, mappings a souvisejících operacích.

## Oprávnění a stav
- Read-only auditní pohled.
