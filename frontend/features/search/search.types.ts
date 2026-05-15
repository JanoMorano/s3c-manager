export interface GlobalSearchItem {
  source_key?: string | null;
  code: string;
  title: string;
  description?: string | null;
  subtitle?: string | null;
  status?: string | null;
  href: string;
  module_code?: string;
  module_label?: string;
  kind?: string;
}

export interface GlobalSearchGroup {
  key: string;
  label: string;
  module_code?: string;
  module_label?: string;
  kind: 'module' | 'help' | string;
  order?: number;
  items: GlobalSearchItem[];
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  groups: GlobalSearchGroup[];
}
