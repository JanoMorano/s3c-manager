import { redirect } from 'next/navigation';

export default function LegacyAdminHubPage() {
  redirect('/management');
}
