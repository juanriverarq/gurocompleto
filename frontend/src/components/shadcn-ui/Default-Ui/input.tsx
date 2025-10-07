import * as React from "react"

import { cn } from "src/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-0 focus:outline-none",
          "bg-white dark:bg-gray-800",
          "border-gray-300 dark:border-darkborder focus:border-primary",
          "text-gray-900 dark:text-white",
          "placeholder:text-gray-500 dark:placeholder:text-gray-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:rounded-sm file:text-sm file:font-medium file:text-primary file:bg-lightprimary",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
