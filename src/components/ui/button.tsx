import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:bg-primary/90 active:bg-primary/95',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:bg-destructive/90 active:bg-destructive/95',
        outline:
          'border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground active:bg-accent/80',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:bg-secondary/80 active:bg-secondary/70',
        ghost: 'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground active:bg-accent/80',
        link: 'text-primary underline-offset-4 hover:underline focus-visible:underline active:text-primary/80',
        success: 'bg-success text-success-foreground hover:bg-success/90 focus-visible:bg-success/90 active:bg-success/95',
        warning: 'bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:bg-warning/90 active:bg-warning/95',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
