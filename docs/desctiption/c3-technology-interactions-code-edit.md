# /c3/technology-interactions/[code]/edit

Zdroj: `frontend/app/c3/technology-interactions/[code]/edit/page.tsx`

## Účel
Editace C3 Technology Interaction.

## Pole a ovládací prvky
- Identita: `technology_interaction_code` povinný, `uuid` povinný, `title` povinný.
- Metadata: `modification_date`, `order_num`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `ciav_review_status`, `mcsma_review_status`.
- TIN popis: `technology_interaction_type`, `technology_interaction_maturity`, `service_instructions`, `description`, `conditionality`.
- Raw vazby: `technology_interactions_1_raw`, `services_1_raw`, `applications_1_raw`, `services_2_raw`, `technology_interactions_2_raw`, `technology_interactions_3_raw`, `services_3_raw`, `applications_2_raw`, `data_objects_raw`.

## Vazby na jiné stránky
- Breadcrumb na `/c3/technology-interactions`.
- Linkované služby/aplikace/data objects se zobrazují na detailu podle parseru/link tabulek.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-technology-interactions/{code}`.
- `PUT /api/v1/taxonomy/c3-technology-interactions/{id}`.
- DB: `data.c3_technology_interaction`; link parser plní `c3_technology_interaction_service_link`, `c3_technology_interaction_application_link`, `c3_technology_interaction_data_object_link`.

## Validace a oprávnění
- Code, UUID a title jsou povinné.
- Zápis vyžaduje editor/admin.
