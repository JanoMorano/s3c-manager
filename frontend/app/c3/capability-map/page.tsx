import { redirect } from 'next/navigation';
import { C3_ROUTES } from '../../lib/c3Routes';

function buildQueryString(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry != null && entry !== '') params.append(key, entry);
      });
      return;
    }
    if (value != null && value !== '') params.set(key, value);
  });
  return params.toString();
}

export default async function LegacyCapabilityMapRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = (await searchParams) ?? {};
  const query = buildQueryString(resolvedParams);
  redirect(query ? `${C3_ROUTES.capabilityMapSpiral7}?${query}` : C3_ROUTES.capabilityMapSpiral7);
}
