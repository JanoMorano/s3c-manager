import type { ComponentProps } from 'react';
import NextLink from 'next/link';

type AppLinkProps = ComponentProps<typeof NextLink>;

export default function AppLink({ prefetch = false, ...props }: AppLinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}
