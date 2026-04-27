# Spiral Fulfillment Strategy

The fulfillment plan is decision support for Capability Managers and governance boards. It translates coverage, gaps, and overlap into candidate actions; it is not an automatic project-management or procurement decision.

## Interpretation rules

- **Coverage** means an imported C3 requirement is linked to a Level-3 capability and at least one catalogue service maps to that capability or requirement.
- **Gap** means a requirement exists in the selected spiral but no active catalogue service covers it explicitly.
- **Overlap** means two or more services cover the same requirement. This can be healthy redundancy or a consolidation opportunity.
- **No data** is not zero capability. It means requirements or evidence are missing and should be treated as data-quality debt.

## Buckets

| Bucket | Meaning | Typical owner |
|---|---|---|
| Quick wins | Existing service likely covers a gap but needs explicit mapping/evidence | Service Owner |
| Enrichment needed | Capability/service exists but metadata, C3 link, or source evidence is incomplete | Service Owner |
| Build needed | No known service covers the requirement | Capability Manager |
| Consolidation candidates | Overlap is high enough to review duplicate operational cost | Capability Manager + Service Owner |
| Retire or merge candidates | Unique coverage is low and another service covers most requirements | Governance board |

## Prioritization

Use a lightweight ICE-style score:

`priority = impact * confidence / effort`

- **Impact:** number and criticality of uncovered requirements affected.
- **Confidence:** strength of evidence from C3 links, service mappings, and source documents.
- **Effort:** expected change size: metadata update < mapping enrichment < service integration < new build.

## Language rules

- Use **candidate**, **suggested**, and **decision support** for heuristic recommendations.
- Use **evidence-backed** only when a requirement and service mapping are both present.
- Cost-saving language must stay neutral: “possible consolidation candidate”, not “remove application”.
