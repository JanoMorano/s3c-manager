# /c3/technology-interactions/[code]

Zdroj: `frontend/app/c3/technology-interactions/[code]/page.tsx`

## Účel
Detail C3 Technology Interaction.

## Pole a ovládací prvky
- Read-only pole: `technology_interaction_code`, `uuid`, `title`, `technology_interaction_type`, `technology_interaction_maturity`, `description`, `conditionality`, `service_instructions`, `ciav_review_status`, `mcsma_review_status`, `ss_overall_status`, `ss_baseline_status`, `item_status`, `modification_date`, `order_num`.
- Raw/link fields: `technology_interactions_1_raw`, `services_1_raw`, `applications_1_raw`, `services_2_raw`, `technology_interactions_2_raw`, `technology_interactions_3_raw`, `services_3_raw`, `applications_2_raw`, `data_objects_raw`.
- Link sekce ukazuje linked services, applications a data objects.

## Vazby na jiné stránky
- Zpět na `/c3/technology-interactions`.
- Edit `/c3/technology-interactions/{code}/edit`.
- Linked entity vedou na jejich C3 detail.

## API a DB vazby
- `GET /api/v1/taxonomy/c3-technology-interactions/{code}`.
- DB: `data.c3_technology_interaction` a TIN link tabulky.
