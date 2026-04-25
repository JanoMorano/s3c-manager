/**
 * Layer 3 — Button
 * Thin wrapper around shadcn/ui Button for backward compatibility.
 * Maps legacy variant/size names → new CVA variants.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button as ShadButton } from '@/components/ui/button';
import type { ButtonProps as ShadButtonProps } from '@/components/ui/button';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_MAP: Record<ButtonVariant, ShadButtonProps['variant']> = {
  primary:     'default',
  secondary:   'secondary',
  ghost:       'ghost',
  danger:      'outline',
  dangerSolid: 'destructive',
};

const SIZE_MAP: Record<ButtonSize, ShadButtonProps['size']> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
};

export function Button({
  variant = 'primary',
  size    = 'md',
  loading = false,
  children,
  ...rest
}: ButtonProps) {
  return (
    <ShadButton
      variant={VARIANT_MAP[variant]}
      size={SIZE_MAP[size]}
      loading={loading}
      {...rest}
    >
      {children}
    </ShadButton>
  );
}
