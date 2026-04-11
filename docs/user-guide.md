# User Guide

## Application Purpose

Service Catalogue is a catalogue of services and, optionally, C3 taxonomy data. It is used to read and manage:

- service catalogue records
- relationships between services
- pricing and SLA variants
- C3 capabilities and C3 entities
- mappings between the service catalogue and the C3 taxonomy
- imports and audit history

## Roles and Permissions

- `viewer` — read-only access to catalogue data, C3 data, and dashboards
- `editor` — content management, imports, new records, and business-data editing
- `admin` — everything from `editor` plus users, groups, web/SSO settings, references, and installation management

## Main Navigation After Login

After login, the landing page exposes three main areas:

- `Service Catalogue`
- `C3 Taxonomy`
- `C3 Capability Map`

The left navigation is grouped into the same dropdown sections. If the C3 module is disabled during installation, all C3 groups disappear from the UI.

## Service Catalogue

### All Services List

Route:

```text
/services/list
```

The service list is the main working view for the catalogue. It supports:

- full-text search
- filtering by state, type, portfolio, and domain
- sorting by key business columns
- opening a detail page by clicking `service_id` or title

### Services Dashboard

Route:

```text
/services/dashboard
```

The dashboard shows aggregated catalogue metrics, state distribution, type distribution, and governance indicators.

### Services Graph View

Route:

```text
/services/graph
```

The global graph displays services and their relationships. The top toolbar allows:

- `Connector type`
- `Line style`
- overlays such as `C3 Taxonomy` and `Flavours`
- PDF export

### Service Dependency Graph

Route:

```text
/services/DEMO-DAP-003/graph
```

This view focuses on one service at a time. You can choose the service in the top section and display its local subgraph.

`Depth` means:

- `1` — direct dependencies only
- `2` — direct dependencies plus immediate context
- `3` — the widest subgraph for a single service

It also supports:

- `Connector type`
- `Line style`
- PDF export

### Service Detail

Route:

```text
/services/{service_id}
```

The detail view is divided into themed sections and a right-side navigation rail. Users can inspect:

- service identity
- business description
- pricing flavours
- SLA
- ownership
- network/domain availability
- service relations
- C3 mappings
- validation and completeness score

### Service Editing

Route:

```text
/services/{service_id}/edit
```

Editing is available to `editor` and `admin`. The form uses section-based layout and validation blocks. The C3 mapping area works with:

- primary capability
- additional capability mappings
- PACE categories
- readiness and validation warnings

## C3 Taxonomy

### All C3 List

Route:

```text
/c3/list
```

This is the central capability list. Common filters include:

- C3 relation graph
- search
- C3 taxonomy type
- state
- quick views
- parent capability

Clicking the title opens the capability detail.

### C3 Dashboard

Route:

```text
/c3/dashboard
```

The dashboard summarizes the state of C3 data. Current blocks include:

- status breakdown
- needs mapping
- most mapped items
- coverage by application
- sync status
- capability map health
- import & sync drift
- link health
- review / validation

### C3 Capability Detail

Route:

```text
/c3/{uuid}
```

Capability detail pages use a standardized section order:

1. classification & hierarchy
2. identity
3. description
4. source & data quality
5. relationships & capability completeness
6. structured data (raw JSON/text)

The relationships and completeness section also includes `Service Catalogue` mappings.

### C3 Entity Views

Public lists and details exist for:

- `C3 Technology Interactions`
- `C3 Services`
- `C3 Data Objects`
- `C3 Applications`

Routes:

```text
/c3/technology-interactions
/c3/services
/c3/data-objects
/c3/applications
```

Each entity detail page uses the same layout pattern as capability detail pages: header, summary, sections, and right rail.

## C3 Graph

Route:

```text
/c3/graph
```

The C3 graph uses the same control style as the service graph:

- `Connector type`
- `Line style`
- PDF export

For larger datasets, a lighter-weight rendering mode is used so the graph remains usable with many nodes.

## C3 Capability Map

Two maps are available:

```text
/c3/capability-map-spiral6
/c3/capability-map-spiral7
```

Both maps share the same visual layout. The difference is in the data source:

- `Spiral 6` — historical snapshot
- `Spiral 7` — current baseline capability map

From the map you can open:

- the capability detail
- linked service catalogue records
- child capability lists

## Imports

Content import is available to `editor` and `admin`.

Route:

```text
/import/upload
```

Supported import targets:

- Service Catalogue CSV/JSON
- C3 Taxonomy CSV/JSON/XLSX
- C3 Applications, Data Objects, Services, and Technology Interactions
- C3 Capability Map CSV/JSON
- FMN spiral taxonomy XLSX reports

Depending on the target, the import UI supports:

- dry-run
- commit
- import history
- issue logs with warning and error entries

## Search

Global search is available in the top-right area of the application. Results are grouped by source:

- services
- C3 capabilities
- C3 entities
- capability builder

Each result links directly to the appropriate detail page.

## Working with Demo Data

If test data was loaded during installation or through the admin tools, you will see:

- demo services in the Service Catalogue
- demo C3 capabilities
- demo mappings in Spiral 6 and Spiral 7 capability maps
- example dependency graphs and C3 relations

Demo data is intended to make it easy to understand:

- service detail pages
- service graphs
- C3 mappings
- capability map coverage

## Common User Scenarios

### Find a Service and Its Dependencies

1. Open `/services/list`
2. Search by `service_id` or title
3. Open the detail page
4. Switch to `Graph` or `Service Dependency Graph`

### Find a Capability and Its Mappings

1. Open `/c3/list`
2. Filter by capability type or parent capability
3. Open the capability detail
4. Check the `Relationships & capability completeness` section for catalogue mappings

### Walk Through the Spiral 6 or Spiral 7 Capability Map

1. Open `C3 Capability Map`
2. Choose `Spiral 6` or `Spiral 7`
3. Click a capability node or row
4. Open the detail page or the child list

## If Something Does Not Work

- if the administration menu does not appear after login, reload the page and verify the user role
- if a detail page or editor returns `404`, verify the matching C3 code or UUID exists
- if a graph shows too little data, check the `C3 Taxonomy`, `Flavours`, and `Depth` toggles
- if an import ends with warnings, review the reference data and the import issue log
