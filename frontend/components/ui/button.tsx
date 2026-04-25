import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-[#18181b] text-white hover:bg-black',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline:     'border border-[var(--color-border-default)] bg-transparent hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]',
        secondary:   'bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-default)]',
        ghost:       'hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]',
        link:        'text-[var(--color-info)] underline-offset-4 hover:underline',
        success:     'bg-green-600 text-white hover:bg-green-700',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-7 rounded px-3 text-xs',
        lg:      'h-11 rounded-md px-8',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg className="animate-spin size-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </>
        ) : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
