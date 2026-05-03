# /capabilities/gaps

Zdroj: `frontend/app/capabilities/gaps/page.tsx`, komponenta `CapabilityGovernancePage`

## Účel
Seznam uncovered nebo not-ready capabilities s doporučenými dalšími kroky.

## Pole a ovládací prvky
- Stejný filter bar jako coverage: `spiral`, `domain`, `readiness`; URL může nést i `lifecycle` a `owner`.
- Tabulka ukazuje capability, spiral, coverage, mapped services a recommended action.

## Vazby na jiné stránky
- Capability detail `/capabilities/{slug}` nebo `/c3/{uuid}`.
- Služby `/services/{service_id}`.
- Link na `/capabilities/coverage` pro návrat do matice.

## API a DB vazby
- `GET /api/v1/capabilities/gaps`.
- DB: C3 taxonomy/builder, `service_c3_mapping`, readiness/governance data.

## Oprávnění a stav
- Read-only; opravy se provádí v service editoru nebo C3 editaci.
