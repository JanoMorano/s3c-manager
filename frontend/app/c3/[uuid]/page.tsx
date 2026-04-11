'use client';

import { CapabilityDetailPage } from '@/features/c3/components/CapabilityDetailPage';

interface Props {
  params: Promise<{ uuid: string }>;
}

export default function C3ItemPreviewPage({ params }: Props) {
  return <CapabilityDetailPage params={params} mode="view" />;
}
