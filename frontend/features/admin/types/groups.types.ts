export type PermissionScope = 'service_catalogue' | 'c3_taxonomy'
export type PermissionType  = 'view_column' | 'edit_column' | 'edit_ref'

export interface GroupPermission {
  scope:      PermissionScope
  permission: PermissionType
  resource:   string
}

export interface GroupMember {
  user_sub:    string
  assigned_at: string
  assigned_by: string | null
}

export interface AppGroup {
  id:           number
  group_code:   string
  group_name:   string
  description:  string | null
  is_active:    boolean
  created_at:   string
  updated_at:   string
  member_count?: number
  permissions?:  GroupPermission[]
  members?:      GroupMember[]
}
