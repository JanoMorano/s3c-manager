import CapabilityMapPage from '../capability-map/CapabilityMapPage';

export default function C3CapabilityMapSpiral7Page() {
  return (
    <CapabilityMapPage
      apiPath="/api/v1/taxonomy/c3/capability-map-spiral7"
      activeSpiralCode="Spiral_7"
      builderHref="/administration/c3-capability-builder"
    />
  );
}
