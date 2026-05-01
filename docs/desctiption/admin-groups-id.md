# /admin/groups/[id]

Zdroj: `frontend/app/admin/groups/[id]/page.tsx`, constants `frontend/features/admin/constants/permissionResources.ts`

## Účel
Detail RBAC skupiny: základní informace, oprávnění a členové.

## Pole a ovládací prvky
- Tab `Info`: `group_code` read-only, `group_name` povinný, `description`, active/inactive toggle.
- Tab `Permissions`: checkbox grid podle scope/permission/resource; podporuje Select All a Deselect All.
- Scope `service_catalogue`: `view_column`, `edit_column`, `edit_ref`.
- Scope `c3_taxonomy`: `view_column`, `edit_column`, `edit_ref`.
- Resources zahrnují katalogová pole jako title, status, service type, portfolio, domains, pricing, SLA, relations, ownership, C3 mapping, audit history; C3 resources jako c3_uuid, c3_name, c3_domain, sync_status a ref hodnoty.
- Tab `Members`: `newMemberSub` input pro JWT sub claim, Add Member, Remove member.

## Vazby na jiné stránky
- Back na `/admin/groups`.
- Permission model ovlivňuje viditelnost/editovatelnost polí v katalogu služeb a C3 taxonomy.

## API a DB vazby
- `GET /api/v1/admin/groups/{id}`.
- `PUT /api/v1/admin/groups/{id}` pro info.
- `PUT /api/v1/admin/groups/{id}/permissions`.
- `GET/POST /api/v1/admin/groups/{id}/members`.
- `DELETE /api/v1/admin/groups/{id}/members/{userSub}`.
- DB: `app_group`, `app_group_permission`, `app_user_group`.

## Validace a oprávnění
- `group_name` nesmí být prázdný.
- Všechny operace vyžadují admin práva.
