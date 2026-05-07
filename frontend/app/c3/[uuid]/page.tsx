'use client';

import { use } from 'react';
import CapabilityMapPage from '../capability-map/CapabilityMapPage';
import { CapabilityDetailPage } from '@/features/c3/components/CapabilityDetailPage';

interface Props {
  params: Promise<{ uuid: string }>;
}

export default function C3ItemPreviewPage({ params }: Props) {
  const { uuid } = use(params);
  const spiralMatch = uuid.match(/^capability-map-spiral(\d+)$/);
  if (spiralMatch) {
    const spiralNumber = spiralMatch[1];
    const spiralCode = `Spiral_${spiralNumber}`;
    return (
      <CapabilityMapPage
        apiPath={`/api/v1/taxonomy/c3/capability-map-spiral${spiralNumber}`}
        defaultTitle={`C3 Taxonomy Catalogue — Baseline ${spiralNumber}`}
        activeSpiralCode={spiralCode}
        builderHref="/administration/c3-capability-builder"
        emptyStateDescription={`Pro Spiral ${spiralNumber} zatím nejsou v builderu žádné položky.`}
      />
    );
  }

  return <CapabilityDetailPage params={params} mode="view" />;
}
