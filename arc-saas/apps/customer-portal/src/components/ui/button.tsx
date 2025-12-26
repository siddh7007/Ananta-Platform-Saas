import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Mobile: 44px minimum (touch-friendly), Desktop: 40px
        default: "min-h-[44px] md:min-h-[40px] px-4 py-2",
        // Mobile: 40px, Desktop: 36px (still accessible)
        sm: "min-h-[40px] md:min-h-[36px] rounded-md px-3",
        // Mobile: 48px (expanded touch target), Desktop: 44px
        lg: "min-h-[48px] md:min-h-[44px] rounded-md px-8",
        // Icon buttons: 44x44 minimum on touch, 40x40 on desktop
        icon: "min-h-[44px] min-w-[44px] md:min-h-[40px] md:min-w-[40px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  iconOnly?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    loadingText,
    leftIcon,
    rightIcon,
    iconOnly = false,
    children,
    disabled,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Determine the effective size for icon-only buttons
    const effectiveSize = iconOnly ? "icon" : size

    // Compute loading state classes
    const loadingClasses = loading ? "opacity-80" : ""

    // Determine which icon to show on the left
    const displayLeftIcon = loading ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : leftIcon

    // Determine the button content
    const displayContent = loading && loadingText ? loadingText : children

    return (
      <Comp
        className={cn(buttonVariants({ variant, size: effectiveSize, className }), loadingClasses)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {displayLeftIcon}
        {displayContent}
        {!loading && rightIcon}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
