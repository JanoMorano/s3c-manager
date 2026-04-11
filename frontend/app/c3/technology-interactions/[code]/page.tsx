'use client';

import { PublicC3EntityDetailPage } from '../../../c3-entities/PublicC3EntityDetailPage';
import { publicC3TechnologyInteractionsConfig } from '../../../c3-entities/public-config';

interface Props {
  params: Promise<{ code: string }>;
}

export default function C3TechnologyInteractionDetailPage({ params }: Props) {
  return <PublicC3EntityDetailPage params={params} config={publicC3TechnologyInteractionsConfig} />;
}
