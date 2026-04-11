import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ code: string }>;
}

export default async function C3TechnologyInteractionAdminEditPage({ params }: Props) {
  const { code } = await params;
  redirect(`/c3/technology-interactions/${encodeURIComponent(code)}/edit`);
}
