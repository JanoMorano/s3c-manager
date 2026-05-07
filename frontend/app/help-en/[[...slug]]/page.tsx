import { notFound } from 'next/navigation';
import HelpManual from '@/app/_help/HelpManual';
import { HELP_PAGES_EN } from '@/app/_help/helpContent.en';
import { findHelpPage, generateHelpStaticParams } from '@/app/_help/helpPage';

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export function generateStaticParams() {
  return generateHelpStaticParams(HELP_PAGES_EN);
}

export async function generateMetadata({ params }: Props) {
  const page = findHelpPage(HELP_PAGES_EN, (await params).slug);

  return {
    title: page ? `${page.title} - S3C Manager Help` : 'S3C Manager Help',
  };
}

export default async function EnglishHelpPage({ params }: Props) {
  const page = findHelpPage(HELP_PAGES_EN, (await params).slug);

  if (!page) notFound();

  return <HelpManual nodes={page.body} />;
}
