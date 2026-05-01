# /services/[id]/edit

Zdroj: `frontend/app/services/[id]/edit/page.tsx`, API `frontend/features/services/api/editor.api.ts`

## Účel
Hlavní editor služby. Umožňuje upravit katalogový záznam, role, domény, SLA, pricing/flavours, offerings, vztahy, C3 mapping, support model, audience policy a operational links.

## Hlavní formulář služby
- Basic Identity: `title` povinný, `service_type` povinný select, `service_status` select (`active`, `retired`, `deprecated`, `draft`).
- Description: `summary`, `detailed_description`, `value_proposition`, `business_purpose`, `service_features`, `scope_text`.
- Catalogue Access & Request Model: `business_summary`, `consumer_value`, `lifecycle_state`, `request_channel_type`, `request_channel_url`, `target_audience_summary`, `fulfillment_lead_time_text`, `requestable`, `approval_required`.
- Lifecycle transitions jsou omezené mapou: draft -> under_review, under_review -> draft/approved, approved -> under_review/live, live -> deprecated, deprecated -> live/retired, retired -> deprecated.
- Classification: `portfolio_group_code`, `security_classification`, `service_area`, `global_service_group_code`, `service_line_code`, `organizational_element_code`.
- Ownership: `service_owner`, `service_owner_email`, `vlastnik`, `vlastnik_org`, `manager`, `manager_org`, `service_owner_org`.
- Availability & Domains: `sla_availability`, `sla_restoration`, `sla_delivery`, domain checkboxes.
- Governance/technical: `retired_note`, `source_url`, `unit_of_measure`, `charging_basis`, `rate_note`, `ordering_note`, `operational_notes_raw`, `exclusions`, `sla_restoration_text`, `sla_delivery_text`, `customer_type`, `notes_json`.

## Podformuláře a kolekce
- SLA override: `flavour`, `support_window_code`, `availability_pct`, `restoration_hours`, `delivery_days`, `sla_note_raw`, `priority_model_raw`.
- Flavours/pricing: `title`, `service_unit`, `price_value`, `currency_code`, `billing_period_code`, `initiation_cost`, `lifecycle_cost`, `lifetime_years`, `display_order`, `flavour_status_code`, `is_orderable`, `short_note`, `pricing_note_raw`, `dependency_text`, `nations_rate`, `delivery_note`, `technical_note`.
- Offerings: `offering_code`, `title`, `status`, `description`, `request_channel_type`, `request_channel_url`, `lead_time_text`, `support_tier_code`, `display_order`, `is_default`, `requestable`, `approval_required`.
- Relationships: target service, `relation_type`, `relation_label`, `impact_mode`, `impact_level`, `pace_code`, `is_verified`.
- C3 mapping: `c3_uuid`, `mapping_type_code`, `is_primary`, `mapping_note`; má preview před uložením.
- Support model: `offering`, `support_owner_name`, `resolver_group`, `support_hours_code`, `support_channel`, `review_cadence`, `escalation_path`, `maintenance_window`.
- Audience policies: `offering`, `audience_type`, `business_unit`, `region_code`, `eligibility_rule`, `notes`.
- Operational links: `offering`, `link_type`, `sort_order`, `title`, `url`.
- Raw fields jsou read-only a ukazují parser output.

## Vazby na jiné stránky
- Cancel/detail na `/services/{id}`.
- Sekce C3 linkuje na `/c3/{uuid}`.
- Relationship a service picker používají ostatní služby z katalogu.

## API a DB vazby
- `PUT /api/v1/services/{id}` pro hlavní službu.
- `PUT /api/v1/services/{id}/domains`, `PUT /api/v1/services/{id}/roles`.
- Flavours přes `/api/v1/flavours`, SLA přes `/api/v1/services/{id}/sla`, offerings přes `/api/v1/services/{id}/offerings`.
- Support model, audience a operational links přes `/api/v1/services/{id}/support-model`, `/audience`, `/operational-links`.
- Relationships přes `/api/v1/relations`.
- C3 mapping přes `/api/v1/services/{id}/preview-mapping`, `/api/v1/taxonomy/mapping/{id}`.
- DB: `service_catalog`, `service_available_on`, `service_role_assignment`, `service_flavour`, `service_sla`, `service_offering`, `service_support_model`, `service_audience_policy`, `service_operational_link`, `service_relation`, `service_c3_mapping`, `service_raw_field` a ref tabulky.

## Validace a oprávnění
- Používá `react-hook-form` a `zod`.
- URL pole validují URL formát; email pole validuje email; procenta mají rozsah 0-100.
- Requestable služba varuje bez request channel nebo support modelu.
