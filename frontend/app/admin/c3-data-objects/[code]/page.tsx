import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ code: string }>;
}

export default async function C3DataObjectAdminEditPage({ params }: Props) {
  const { code } = await params;
  redirect(`/c3/data-objects/${encodeURIComponent(code)}/edit`);
}
