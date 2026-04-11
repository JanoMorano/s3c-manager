import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ code: string }>;
}

export default async function C3ApplicationAdminEditPage({ params }: Props) {
  const { code } = await params;
  redirect(`/c3/applications/${encodeURIComponent(code)}/edit`);
}
