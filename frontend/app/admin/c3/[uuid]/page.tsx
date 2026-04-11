import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ uuid: string }>;
}

export default async function C3ItemDetailPage({ params }: Props) {
  const { uuid } = await params;
  redirect(`/c3/${encodeURIComponent(uuid)}/edit`);
}
