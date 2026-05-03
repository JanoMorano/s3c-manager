# /services/[id]

Zdroj: `frontend/app/services/[id]/page.tsx`

## Účel
Detail služby ve stylu Service 360. Kombinuje business popis, nabídky, request model, podporu, coverage, governance, vztahy, pricing, SLA a auditovatelné metriky.

## Pole a ovládací prvky
- Inline status select v hlavičce ukládá `service_status`; možnosti zahrnují `active`, `planned`, `retired`, `deprecated`, `draft`.
- Záložky: `overview`, `offerings`, `request`, `coverage`, `governance`.
- Akční odkazy: editace, service graph, history, source URL, request channel, governance workflow.
- Většina obsahu je read-only, kromě inline změny statusu.

## Zobrazené sekce
- Overview: Service360 metriky, readiness blockers/warnings, business value, scope, SLA a operations links.
- Offerings: service offerings a pricing variants/flavours.
- Request: requestable stav, request channel, lead time, approval, eligibility/audience policies a support model.
- Coverage: framework/C3 coverage a linky na `/capabilities/{slug}`.
- Governance: metadata, relationships, C3 mapping, raw/extended data, score breakdown, ownership history a retirement note.

## Vazby na jiné stránky
- `/services/{id}/edit`, `/services/{id}/graph`, `/services/{id}/history`.
- Capability odkazy na `/capabilities/{slug}` a C3 odkazy na `/c3/{uuid}`.
- Relationship řádky odkazují na cílové služby `/services/{target_id}`.

## API a DB vazby
- `GET /api/v1/services/{id}`, `/overview`, `/offerings`, `/support-model`, `/audience`, `/operational-links`, `/sla`, `/score`, `/roles`, `/c3-mappings`, `/frameworks`.
- Inline status ukládá přes `PUT /api/v1/services/{id}`.
- Governance části používají `/api/v1/governance/reviews` a `/api/v1/governance/decisions`.
- DB: `service_catalog`, `service_offering`, `service_flavour`, `service_sla`, `service_support_model`, `service_audience_policy`, `service_operational_link`, `service_relation`, `service_role_assignment`, `service_c3_mapping`, C3 tabulky a governance tabulky.

## Oprávnění a validace
- Detail je read-only pro běžný pohled; edit/status zápisy vyžadují odpovídající roli.
