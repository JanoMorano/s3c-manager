# /management/new-service

Zdroj: `frontend/app/management/new-service/page.tsx`

## Účel
Wizard pro ruční založení nové služby v katalogu.

## Pole a kroky
- Identita: `service_id` povinný max 20 znaků uppercase, `title` povinný, `service_type` povinný, `service_status`, `lifecycle_state`.
- Popis: `summary`, `business_summary`, `consumer_value`, `value_proposition`, `business_purpose`.
- Access: `requestable`, `request_channel_type`, `request_channel_url`, `approval_required`, `fulfillment_lead_time_text`, `target_audience_summary`.
- Classification: `portfolio_group_code`, `service_line_code`, `organizational_element_code`, `global_service_group_code`, `security_classification`.
- Ownership: `service_owner`, `service_owner_email`, `service_owner_org`, `vlastnik`, `manager`.
- SLA/domains: `sla_availability`, `sla_restoration`, `sla_delivery`, domény.
- C3 mapping krok je vidět při aktivním C3 modulu; vybrané capability se ukládají do `notes_json` jako pending evidence.
- Review krok shrnuje payload před vytvořením.

## Vazby na jiné stránky
- Po úspěšném vytvoření přesměruje na `/services/{service_id}/edit`.
- Využívá taxonomy referenční data stejná jako editor služby.

## API a DB vazby
- `POST /api/v1/services`.
- Doplňkově `PUT /api/v1/services/{id}/domains` a role update.
- Ref data: `/api/v1/taxonomy/service-types`, portfolio, service lines, organizational elements, global service groups, security classifications, domains, C3.
- DB: `service_catalog`, `service_available_on`, `service_role_assignment`, ref tabulky; pending C3 evidence v `notes_json`.

## Validace a oprávnění
- `zod` schema kontroluje povinná pole, email, URL a SLA rozsah 0-100.
- Zápis vyžaduje editor/admin práva.
