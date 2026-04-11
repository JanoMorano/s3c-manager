import CapabilityMapPage from '../capability-map/CapabilityMapPage';

export default function C3CapabilityMapSpiral7Page() {
  return (
    <CapabilityMapPage
      apiPath="/api/v1/taxonomy/c3/capability-map-spiral7"
      defaultTitle="C3 Taxonomy Catalogue — Baseline 7"
      builderHref="/admin/c3-capability-builder"
      emptyStateDescription="Pro C3 Capability Map Spiral 7 zatím nejsou v builderu žádná data."
    />
  );
}
