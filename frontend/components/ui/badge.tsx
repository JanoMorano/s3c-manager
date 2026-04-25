import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-[var(--color-action-primary)] text-white',
        secondary:   'border-transparent bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]',
        destructive: 'border-transparent bg-[var(--color-danger)] text-white',
        outline:     'border-[var(--color-border-default)] text-[var(--color-text-primary)]',
        success:     'border-transparent bg-[var(--color-success)] text-white',
        warning:     'border-transparent bg-[var(--color-warning)] text-white',
        info:        'border-transparent bg-[var(--color-info)] text-white',
        draft:       'border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]',
        live:        'border-transparent bg-[var(--color-success)] text-white',
        deprecated:  'border-transparent bg-[var(--color-warning)] text-white',
        retired:     'border-transparent bg-[var(--color-danger)] text-white',
        review:      'border-transparent bg-[var(--color-info)] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
