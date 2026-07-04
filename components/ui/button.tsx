'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:            'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:          'border border-border text-muted-foreground hover:bg-muted',
        outline:            'border border-border bg-card text-foreground hover:bg-muted',
        ghost:              'text-muted-foreground hover:bg-muted hover:text-foreground',
        'ghost-primary':    'text-muted-foreground hover:text-primary hover:bg-primary/5',
        'ghost-destructive':'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
        destructive:        'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link:               'text-destructive underline-offset-4 hover:underline',
      },
      size: {
        default:   'h-9 px-4 text-sm',
        sm:        'h-8 px-3 text-xs',
        xs:        'h-7 px-2 text-xs',
        lg:        'h-11 px-4 text-sm',
        icon:      'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-xs': 'h-6 w-6 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
