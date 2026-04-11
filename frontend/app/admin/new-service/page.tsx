import { redirect } from 'next/navigation';

export default function LegacyAdminNewServicePage() {
  redirect('/management/new-service');
}
