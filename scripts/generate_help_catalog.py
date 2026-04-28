#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'frontend' / 'app'
EXCLUDED_PRODUCTION_ROUTES = {'/c3/fmn-air-c2'}


def route_from_page(path: Path) -> str:
    rel = path.relative_to(APP)
    parts = rel.parts[:-1]
    return '/' + '/'.join(parts)


def humanize(key: str) -> str:
    return key.replace('_', ' ').replace('-', ' ').strip().title()


def extract_zod_schema(file_path: Path):
    text = file_path.read_text(encoding='utf-8')
    m = re.search(r"const\s+schema\s*=\s*z\.object\(\{", text)
    if not m:
        return {}
    i = m.end()
    depth = 1
    body = []
    while i < len(text) and depth > 0:
        ch = text[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                break
        body.append(ch)
        i += 1
    out = {}
    for line in ''.join(body).splitlines():
        line = line.strip()
        if not line or line.startswith('//'):
            continue
        m2 = re.match(r"([a-zA-Z0-9_]+)\s*:\s*(.+?)(,)?$", line)
        if m2:
            key, expr = m2.group(1), m2.group(2)
            out[key] = expr
    return out


def extract_register_keys(file_path: Path):
    text = file_path.read_text(encoding='utf-8')
    return sorted(set(re.findall(r"register\('([^']+)'", text)))


def add_field(key, label=None, dtype='string', validation=None, allowed=None, required='optional', default=None, impact='Influences saved entity values and downstream reporting exports.'):
    return {
        'key': key,
        'label': label or humanize(key),
        'data_type': dtype,
        'validation': validation or 'Not explicitly constrained in UI beyond backend checks.',
        'allowed_values': allowed or [],
        'required': required,
        'default': default,
        'impact': impact,
    }


def service_form(route, file_rel):
    fp = ROOT / file_rel
    schema = extract_zod_schema(fp)
    keys = extract_register_keys(fp)
    fields = []
    for k in keys:
        expr = schema.get(k, '')
        dtype = 'string'
        if 'z.boolean' in expr:
            dtype = 'boolean'
        elif 'z.coerce.number' in expr or 'type="number"' in fp.read_text(encoding='utf-8'):
            if k in {'sla_availability', 'sla_restoration', 'sla_delivery', 'order_num'}:
                dtype = 'number'
        required = 'required' if '.min(1' in expr and '.optional' not in expr else 'optional'
        validation = expr if expr else 'Bound via react-hook-form register; server validates on submit.'
        allowed = []
        if k == 'lifecycle_state':
            allowed = ['draft', 'under_review', 'approved', 'live', 'deprecated', 'retired']
        if k == 'service_status':
            allowed = ['active', 'retired', 'deprecated', 'draft']
        fields.append(add_field(k, dtype=dtype, validation=validation, allowed=allowed, required=required, default=None))
    return {
        'route': route,
        'sections': [
            {
                'section': 'Main editor',
                'forms': [
                    {'form': 'Entity form', 'fields': fields}
                ]
            }
        ]
    }


def parse_edit_fields_from_config():
    text = (ROOT / 'frontend/app/admin/c3-entities/config.tsx').read_text(encoding='utf-8')
    configs = {}
    for cfg in ['c3DataObjectsConfig','c3ApplicationsConfig','c3ServicesConfig','c3TechnologyInteractionsConfig']:
        m = re.search(rf"{cfg}:.*?editFields:\s*\[(.*?)\]\s*,\n\}};", text, re.S)
        if not m:
            continue
        arr = m.group(1)
        fields=[]
        for obj in re.finditer(r"\{\s*key:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'(.*?)\}", arr, re.S):
            key, label, tail = obj.group(1), obj.group(2), obj.group(3)
            dtype='string'
            if "type: 'textarea'" in tail:
                dtype='textarea'
            elif "type: 'number'" in tail:
                dtype='number'
            elif "type: 'checkbox'" in tail:
                dtype='boolean'
            elif "type: 'datetime-local'" in tail:
                dtype='datetime'
            req='required' if 'required: true' in tail else 'optional'
            fields.append(add_field(key,label,dtype,required=req,validation='Configured in editFields; API endpoint performs semantic validation.'))
        configs[cfg]=fields
    return configs

routes = [route_from_page(p) for p in sorted(APP.rglob('page.tsx'))]
routes = [r for r in routes if r not in EXCLUDED_PRODUCTION_ROUTES]

catalog = {
    'generated_at': '2026-04-28',
    'scope': 'frontend/app/**/page.tsx',
    'routes': []
}

for r in routes:
    catalog['routes'].append({'route': r, 'sections': []})

route_map = {r['route']: r for r in catalog['routes']}

route_map['/management/new-service'] = service_form('/management/new-service', 'frontend/app/management/new-service/page.tsx')
route_map['/services/[id]/edit'] = service_form('/services/[id]/edit', 'frontend/app/services/[id]/edit/page.tsx')
route_map['/management/new-c3'] = service_form('/management/new-c3', 'frontend/app/management/new-c3/page.tsx')

c3_cfg = parse_edit_fields_from_config()
for rt,cfg in [
    ('/admin/c3-services','c3ServicesConfig'),
    ('/admin/c3-data-objects','c3DataObjectsConfig'),
    ('/admin/c3-application','c3ApplicationsConfig'),
    ('/admin/c3-technology-interactions','c3TechnologyInteractionsConfig'),
    ('/c3/services/[code]/edit','c3ServicesConfig'),
    ('/c3/data-objects/[code]/edit','c3DataObjectsConfig'),
    ('/c3/applications/[code]/edit','c3ApplicationsConfig'),
    ('/c3/technology-interactions/[code]/edit','c3TechnologyInteractionsConfig'),
]:
    route_map[rt] = {
        'route': rt,
        'sections': [{'section':'Entity editor','forms':[{'form':'Grid row editor','fields':c3_cfg.get(cfg,[])}]}]
    }

route_map['/login'] = {
    'route':'/login',
    'sections':[{'section':'Authentication','forms':[{'form':'Sign in','fields':[
        add_field('username','Username','string',required='required',validation='HTML required attribute.',impact='Controls authentication identity and audit logging.'),
        add_field('password','Password','password',required='required',validation='HTML required attribute.',impact='Used for authentication; failed validation blocks access.')
    ]}]}]
}

route_map['/search'] = {'route':'/search','sections':[{'section':'Search','forms':[{'form':'Fulltext search','fields':[add_field('q','Search query','string',required='required',validation='Form submit requires non-empty query in client state.',impact='Filters global search results ranking and list content.')]}]}]}

route_map['/user-info'] = {
    'route':'/user-info',
    'sections':[
        {'section':'Profile','forms':[{'form':'Profile form','fields':[
            add_field('display_name','Display name','string',required='required',impact='Shown in UI ownership labels and user audit context.'),
            add_field('email','E-mail','string',required='required',validation='Must be valid e-mail format.',impact='Used for notifications and owner reporting dimensions.'),
            add_field('locale','Locale','string',required='optional',allowed=['cs-CZ','en-US'],impact='Changes localization of formatted dates/numbers in reports.')
        ]}]},
        {'section':'Security','forms':[{'form':'Password change','fields':[
            add_field('current_password','Current password','password',required='required',impact='Authorizes sensitive credential change action.'),
            add_field('new_password','New password','password',required='required',validation='Policy enforced server-side (min length/complexity).',impact='Affects account security posture and auth success.'),
            add_field('confirm_password','Confirm password','password',required='required',validation='Must match new password.',impact='Prevents accidental credential mismatch during update.')
        ]}]}
    ]
}

route_map['/admin/catalogue-ref'] = {
    'route':'/admin/catalogue-ref',
    'sections':[{'section':'Reference tables','forms':[{'form':'Ref table row editor','fields':[
        add_field('table','Reference table','string',required='required',impact='Chooses controlled vocabulary scope used by service forms and filters.'),
        add_field('key','Reference key','string',required='required',impact='Stored canonical value referenced by foreign-key style fields in services.'),
        add_field('label','Reference label','string',required='required',impact='Displayed in dropdowns and reports as user-facing dimension text.'),
        add_field('sort_order','Sort order','number',required='optional',default=0,impact='Determines ordering in editors and exported codebooks.'),
        add_field('is_active','Active','boolean',required='optional',default=True,impact='Inactive values are hidden/blocked in selection UIs and QA checks.')
    ]}]}]
}
for rt in ['/admin/groups/new','/admin/groups/[id]']:
    route_map[rt] = {'route':rt,'sections':[{'section':'Group details','forms':[{'form':'Group form','fields':[
        add_field('group_code','Group code','string',required='required',validation='Required in UI; immutable in edit mode.',impact='Primary key for RBAC mapping and reporting joins.'),
        add_field('group_name','Group name','string',required='required',impact='Displayed in user/group administration and permission reports.'),
        add_field('description','Description','textarea',required='optional',impact='Administrative context in audits and exports.'),
        add_field('is_active','Active','boolean',required='optional',default=True,impact='Controls whether group is offered/assignable to users.')
    ]}]},{'section':'Permissions','forms':[{'form':'Permission matrix','fields':[add_field('permissions[]','Permission toggles','boolean',required='optional',impact='Determines effective authorization for protected routes and actions.')]}]}]}

catalog['routes'] = [route_map[r] for r in routes if r in route_map]

out_dir = ROOT / 'dev' / 'docs' / 'help'
out_dir.mkdir(parents=True, exist_ok=True)
json_path = out_dir / 'page-form-catalog.json'
json_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')

rows = ['route|section|form|key|label|data_type|required|default|validation|allowed_values|impact']
for route in catalog['routes']:
    if not route['sections']:
        rows.append(f"{route['route']}|—|—|—|—|—|—|—|No form on this route.|—|No direct reporting impact.")
        continue
    for sec in route['sections']:
        for form in sec['forms']:
            for f in form['fields']:
                rows.append('|'.join([
                    route['route'],sec['section'],form['form'],f['key'],f['label'],f['data_type'],f['required'],str(f['default']),
                    str(f['validation']).replace('|','/'),
                    ', '.join(f['allowed_values']) if f['allowed_values'] else '—',
                    f['impact'].replace('|','/'),
                ]))

md = ['# Katalog formulářových polí podle rout', '', 'Níže je editorská tabulka (pipe-delimited) přímo odvozená z JSON katalogu.', '', *[f'- Celkový počet rout: {len(catalog["routes"])}'], '', '```text', *rows, '```', '']
(out_dir / 'page-form-catalog.editors.md').write_text('\n'.join(md), encoding='utf-8')

print(f'Generated {json_path} and editors table with {len(rows)-1} rows.')
