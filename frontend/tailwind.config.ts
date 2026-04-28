import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './design-system/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background:   'var(--color-bg-canvas)',
        surface:      'var(--color-bg-surface)',
        subtle:       'var(--color-bg-subtle)',
        border:       'var(--color-border-default)',
        'border-strong': 'var(--color-border-strong)',
        primary:      'var(--color-text-primary)',
        secondary:    'var(--color-text-secondary)',
        muted:        'var(--color-text-muted)',
        action:       'var(--color-action-primary)',
        success:      'var(--color-success)',
        warning:      'var(--color-warning)',
        danger:       'var(--color-danger)',
        info:         'var(--color-info)',
        // shadcn/ui compatible names
        card: {
          DEFAULT: 'var(--color-bg-surface)',
          foreground: 'var(--color-text-primary)',
        },
        popover: {
          DEFAULT: 'var(--color-bg-surface)',
          foreground: 'var(--color-text-primary)',
        },
        input: 'var(--color-border-default)',
        ring:  'var(--color-focus-ring)',
      },
      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        sm: 'var(--shadow-low)',
        md: 'var(--shadow-medium)',
      },
    },
  },
  plugins: [],
};

export default config;
