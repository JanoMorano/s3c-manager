import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ code: string }>;
}

export default async function C3ServiceAdminEditPage({ params }: Props) {
  const { code } = await params;
  redirect(`/c3/services/${encodeURIComponent(code)}/edit`);
}
