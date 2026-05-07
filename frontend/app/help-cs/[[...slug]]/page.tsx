import { notFound } from 'next/navigation';
import HelpManual from '@/app/_help/HelpManual';
import { HELP_PAGES_CS } from '@/app/_help/helpContent.cs';
import { findHelpPage, generateHelpStaticParams } from '@/app/_help/helpPage';

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export function generateStaticParams() {
  return generateHelpStaticParams(HELP_PAGES_CS);
}

export async function generateMetadata({ params }: Props) {
  const page = findHelpPage(HELP_PAGES_CS, (await params).slug);

  return {
    title: page ? `${page.title} - S3C Manager nápověda` : 'S3C Manager nápověda',
  };
}

export default async function CzechHelpPage({ params }: Props) {
  const page = findHelpPage(HELP_PAGES_CS, (await params).slug);

  if (!page) notFound();

  return <HelpManual nodes={page.body} />;
}
