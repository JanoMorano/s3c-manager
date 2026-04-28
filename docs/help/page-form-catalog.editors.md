# Katalog formulářových polí podle rout

Níže je editorská tabulka (pipe-delimited) přímo odvozená z JSON katalogu.

- Celkový počet rout: 77

```text
route|section|form|key|label|data_type|required|default|validation|allowed_values|impact
/admin/c3/[uuid]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3/dashboard|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3/graph|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-application/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-application|Entity editor|Grid row editor|application_code|Application|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|data_source|Data source|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|external_id|External id|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|data_qualifier|Data qualifier|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|source_description|Source description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|revised_description|Revised description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-application|Entity editor|Grid row editor|revised|Revised|boolean|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-capability-builder|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-capability-builder2|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-data-objects/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-data-objects|Entity editor|Grid row editor|data_object_code|Data Object|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|provenance_raw|Provenance|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|references_raw|References|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-data-objects|Entity editor|Grid row editor|standards_raw|Standards|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-ref|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-services/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-services|Entity editor|Grid row editor|service_code|Service|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|data_source|Data source|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|external_id|External id|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|data_qualifier|Data qualifier|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|source_description|Source description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|revised_description|Revised description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-services|Entity editor|Grid row editor|revised|Revised|boolean|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/c3-technology-interactions|Entity editor|Grid row editor|technology_interaction_code|Technology Interaction|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|ciav_review_status|CIAV review status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|mcsma_review_status|MCSMA review status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|service_instructions|Service Instructions|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|technology_interaction_type|Technology interaction type|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|technology_interaction_maturity|Technology interaction maturity|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|technology_interactions_1_raw|Technology Interactions 1|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|conditionality|Conditionality|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|services_1_raw|Services 1|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|applications_1_raw|Applications 1|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|services_2_raw|Services 2|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|technology_interactions_2_raw|Technology Interactions 2|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|technology_interactions_3_raw|Technology Interactions 3|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|services_3_raw|Services 3|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|applications_2_raw|Applications 2|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/c3-technology-interactions|Entity editor|Grid row editor|data_objects_raw|Data Objects|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/admin/catalogue-ref|Reference tables|Ref table row editor|table|Reference table|string|required|None|Not explicitly constrained in UI beyond backend checks.|—|Chooses controlled vocabulary scope used by service forms and filters.
/admin/catalogue-ref|Reference tables|Ref table row editor|key|Reference key|string|required|None|Not explicitly constrained in UI beyond backend checks.|—|Stored canonical value referenced by foreign-key style fields in services.
/admin/catalogue-ref|Reference tables|Ref table row editor|label|Reference label|string|required|None|Not explicitly constrained in UI beyond backend checks.|—|Displayed in dropdowns and reports as user-facing dimension text.
/admin/catalogue-ref|Reference tables|Ref table row editor|sort_order|Sort order|number|optional|0|Not explicitly constrained in UI beyond backend checks.|—|Determines ordering in editors and exported codebooks.
/admin/catalogue-ref|Reference tables|Ref table row editor|is_active|Active|boolean|optional|True|Not explicitly constrained in UI beyond backend checks.|—|Inactive values are hidden/blocked in selection UIs and QA checks.
/admin/groups/[id]|Group details|Group form|group_code|Group code|string|required|None|Required in UI; immutable in edit mode.|—|Primary key for RBAC mapping and reporting joins.
/admin/groups/[id]|Group details|Group form|group_name|Group name|string|required|None|Not explicitly constrained in UI beyond backend checks.|—|Displayed in user/group administration and permission reports.
/admin/groups/[id]|Group details|Group form|description|Description|textarea|optional|None|Not explicitly constrained in UI beyond backend checks.|—|Administrative context in audits and exports.
/admin/groups/[id]|Group details|Group form|is_active|Active|boolean|optional|True|Not explicitly constrained in UI beyond backend checks.|—|Controls whether group is offered/assignable to users.
/admin/groups/[id]|Permissions|Permission matrix|permissions[]|Permission toggles|boolean|optional|None|Not explicitly constrained in UI beyond backend checks.|—|Determines effective authorization for protected routes and actions.
/admin/groups/new|Group details|Group form|group_code|Group code|string|required|None|Required in UI; immutable in edit mode.|—|Primary key for RBAC mapping and reporting joins.
/admin/groups/new|Group details|Group form|group_name|Group name|string|required|None|Not explicitly constrained in UI beyond backend checks.|—|Displayed in user/group administration and permission reports.
/admin/groups/new|Group details|Group form|description|Description|textarea|optional|None|Not explicitly constrained in UI beyond backend checks.|—|Administrative context in audits and exports.
/admin/groups/new|Group details|Group form|is_active|Active|boolean|optional|True|Not explicitly constrained in UI beyond backend checks.|—|Controls whether group is offered/assignable to users.
/admin/groups/new|Permissions|Permission matrix|permissions[]|Permission toggles|boolean|optional|None|Not explicitly constrained in UI beyond backend checks.|—|Determines effective authorization for protected routes and actions.
/admin/groups|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/import/bulk-folder|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/import|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/installation|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/new-c3|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin/new-service|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/admin|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/administration/installation|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/administration|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/administration/users|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/administration/web|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/[uuid]/edit|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/[uuid]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/applications/[code]/edit|Entity editor|Grid row editor|application_code|Application|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|data_source|Data source|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|external_id|External id|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|data_qualifier|Data qualifier|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|source_description|Source description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|revised_description|Revised description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]/edit|Entity editor|Grid row editor|revised|Revised|boolean|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/applications/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/applications|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/capability-map|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/capability-map-spiral6|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/capability-map-spiral7|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/dashboard|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|data_object_code|Data Object|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|provenance_raw|Provenance|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|references_raw|References|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]/edit|Entity editor|Grid row editor|standards_raw|Standards|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/data-objects/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/data-objects|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/fmn-air-c2|Coverage calculator|Search|query|Capability/service query|string|required|None|Not explicitly constrained in UI beyond backend checks.|—|Determines selected service set and displayed FMN coverage metrics.
/c3/graph|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/list|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/services/[code]/edit|Entity editor|Grid row editor|service_code|Service|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|data_source|Data source|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|external_id|External id|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|data_qualifier|Data qualifier|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|source_description|Source description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|revised_description|Revised description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]/edit|Entity editor|Grid row editor|revised|Revised|boolean|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/services/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/services|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|technology_interaction_code|Technology Interaction|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|uuid|UUID|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|modification_date|Modification date|datetime|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|order_num|Order|number|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|ss_overall_status|SS overall status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|ss_baseline_status|SS baseline status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|item_status|Item status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|ciav_review_status|CIAV review status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|mcsma_review_status|MCSMA review status|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|service_instructions|Service Instructions|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|title|Title|string|required|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|technology_interaction_type|Technology interaction type|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|technology_interaction_maturity|Technology interaction maturity|string|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|technology_interactions_1_raw|Technology Interactions 1|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|description|Description|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|conditionality|Conditionality|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|services_1_raw|Services 1|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|applications_1_raw|Applications 1|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|services_2_raw|Services 2|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|technology_interactions_2_raw|Technology Interactions 2|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|technology_interactions_3_raw|Technology Interactions 3|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|services_3_raw|Services 3|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|applications_2_raw|Applications 2|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]/edit|Entity editor|Grid row editor|data_objects_raw|Data Objects|textarea|optional|None|Configured in editFields; API endpoint performs semantic validation.|—|Influences saved entity values and downstream reporting exports.
/c3/technology-interactions/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3/technology-interactions|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/c3-dashboard|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/capabilities/[slug]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/capabilities|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/catalogue|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/dashboard|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/import|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/import/upload|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/install|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/login|Authentication|Sign in|username|Username|string|required|None|HTML required attribute.|—|Controls authentication identity and audit logging.
/login|Authentication|Sign in|password|Password|password|required|None|HTML required attribute.|—|Used for authentication; failed validation blocks access.
/management/new-c3|Main editor|Entity form|abbreviation|Abbreviation|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|application|Application|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|data_qualifier|Data Qualifier|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|data_source|Data Source|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|datasets_raw|Datasets Raw|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|description|Description|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|external_id|External Id|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|item_status|Item Status|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|item_type|Item Type|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|order_num|Order Num|number|optional|None|z.coerce.number().optional().nullable()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|parent_code|Parent Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|parent_uuid|Parent Uuid|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|provenance_raw|Provenance Raw|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|references_raw|References Raw|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|revised_description|Revised Description|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|script_raw|Script Raw|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|source_description|Source Description|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|ss_baseline_status|Ss Baseline Status|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|ss_overall_status|Ss Overall Status|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|standards_raw|Standards Raw|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|synonym|Synonym|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|title|Title|string|required|None|z.string().min(1, 'Title is required')|—|Influences saved entity values and downstream reporting exports.
/management/new-c3|Main editor|Entity form|uuid|Uuid|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|business_summary|Business Summary|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|consumer_value|Consumer Value|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|fulfillment_lead_time_text|Fulfillment Lead Time Text|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|global_service_group_code|Global Service Group Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|lifecycle_state|Lifecycle State|string|optional|None|z.string().optional()|draft, under_review, approved, live, deprecated, retired|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|manager|Manager|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|organizational_element_code|Organizational Element Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|portfolio_group_code|Portfolio Group Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|request_channel_url|Request Channel Url|string|optional|None|z.string().url('Musí být platná URL').optional().or(z.literal(''))|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|security_classification|Security Classification|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|service_id|Service Id|string|required|None|z.string().min(1, 'Service ID je povinné').max(20, 'Max 20 znaků')|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|service_line_code|Service Line Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|service_owner|Service Owner|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|service_owner_email|Service Owner Email|string|optional|None|z.string().email('Neplatný email').optional().or(z.literal(''))|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|service_owner_org|Service Owner Org|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|service_type|Service Type|string|required|None|z.string().min(1, 'Typ služby je povinný')|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|sla_availability|Sla Availability|number|optional|None|z.coerce.number().min(0).max(100).optional().nullable()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|sla_delivery|Sla Delivery|number|optional|None|z.coerce.number().min(0).optional().nullable()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|sla_restoration|Sla Restoration|number|optional|None|z.coerce.number().min(0).optional().nullable()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|summary|Summary|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|target_audience_summary|Target Audience Summary|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|title|Title|string|required|None|z.string().min(1, 'Název je povinný')|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|value_proposition|Value Proposition|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management/new-service|Main editor|Entity form|vlastnik|Vlastnik|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/management|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/operations|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/search|Search|Fulltext search|q|Search query|string|required|None|Form submit requires non-empty query in client state.|—|Filters global search results ranking and list content.
/services/[id]/edit|Main editor|Entity form|approval_required|Approval Required|boolean|optional|None|z.boolean().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|business_purpose|Business Purpose|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|business_summary|Business Summary|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|charging_basis|Charging Basis|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|consumer_value|Consumer Value|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|customer_type|Customer Type|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|detailed_description|Detailed Description|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|exclusions|Exclusions|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|fulfillment_lead_time_text|Fulfillment Lead Time Text|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|global_service_group_code|Global Service Group Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|lifecycle_state|Lifecycle State|string|optional|None|z.string().optional()|draft, under_review, approved, live, deprecated, retired|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|manager|Manager|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|manager_org|Manager Org|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|notes_json|Notes Json|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|operational_notes_raw|Operational Notes Raw|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|ordering_note|Ordering Note|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|organizational_element_code|Organizational Element Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|portfolio_group_code|Portfolio Group Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|rate_note|Rate Note|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|request_channel_type|Request Channel Type|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|request_channel_url|Request Channel Url|string|optional|None|z.string().url('Must be a valid URL').optional().or(z.literal(''))|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|requestable|Requestable|boolean|optional|None|z.boolean().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|retired_note|Retired Note|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|scope_text|Scope Text|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|security_classification|Security Classification|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_area|Service Area|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_features|Service Features|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_line_code|Service Line Code|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_owner|Service Owner|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_owner_email|Service Owner Email|string|optional|None|z.string().email().optional().or(z.literal(''))|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_owner_org|Service Owner Org|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_status|Service Status|string|optional|None|z.string().optional()|active, retired, deprecated, draft|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|service_type|Service Type|string|required|None|z.string().min(1, 'Service type is required')|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|sla_availability|Sla Availability|number|optional|None|z.coerce.number().min(0).max(100).optional().nullable()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|sla_delivery|Sla Delivery|number|optional|None|z.coerce.number().min(0).optional().nullable()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|sla_delivery_text|Sla Delivery Text|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|sla_restoration|Sla Restoration|number|optional|None|z.coerce.number().min(0).optional().nullable()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|sla_restoration_text|Sla Restoration Text|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|source_url|Source Url|string|optional|None|z.string().url('Must be a valid URL').optional().or(z.literal(''))|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|summary|Summary|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|target_audience_summary|Target Audience Summary|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|title|Title|string|required|None|z.string().min(1, 'Title is required')|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|unit_of_measure|Unit Of Measure|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|value_proposition|Value Proposition|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|vlastnik|Vlastnik|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/edit|Main editor|Entity form|vlastnik_org|Vlastnik Org|string|optional|None|z.string().optional()|—|Influences saved entity values and downstream reporting exports.
/services/[id]/graph|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/services/[id]/history|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/services/[id]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/services/consolidation-matrix|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/services/dashboard|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/services/dependency-flow|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/services/graph|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/services/list|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/spirals/[code]|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/spirals|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.
/user-info|Profile|Profile form|display_name|Display name|string|required|None|Not explicitly constrained in UI beyond backend checks.|—|Shown in UI ownership labels and user audit context.
/user-info|Profile|Profile form|email|E-mail|string|required|None|Must be valid e-mail format.|—|Used for notifications and owner reporting dimensions.
/user-info|Profile|Profile form|locale|Locale|string|optional|None|Not explicitly constrained in UI beyond backend checks.|cs-CZ, en-US|Changes localization of formatted dates/numbers in reports.
/user-info|Security|Password change|current_password|Current password|password|required|None|Not explicitly constrained in UI beyond backend checks.|—|Authorizes sensitive credential change action.
/user-info|Security|Password change|new_password|New password|password|required|None|Policy enforced server-side (min length/complexity).|—|Affects account security posture and auth success.
/user-info|Security|Password change|confirm_password|Confirm password|password|required|None|Must match new password.|—|Prevents accidental credential mismatch during update.
```
