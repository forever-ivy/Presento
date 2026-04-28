"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type SheetSide = "top" | "right" | "bottom" | "left"

type SheetContextValue = {
  open: boolean
}

const SheetContext = React.createContext<SheetContextValue>({ open: false })

function Sheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setInternalOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <SheetContext.Provider value={{ open }}>
      <SheetPrimitive.Root
        data-slot="sheet"
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </SheetContext.Provider>
  )
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn("fixed inset-0 z-50 bg-black/50", className)}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide
  showCloseButton?: boolean
}) {
  const { open } = React.useContext(SheetContext)

  return (
    <SheetPrimitive.Portal forceMount>
      <AnimatePresence>
        {open ? (
          <>
            <SheetPrimitive.Overlay forceMount asChild>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 bg-black/50"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              />
            </SheetPrimitive.Overlay>
            <SheetPrimitive.Content forceMount asChild {...props}>
              <motion.div
                animate={sheetMotionAnimate(side)}
                className={cn(sheetSideClassName(side), className)}
                exit={sheetMotionExit(side)}
                initial={sheetMotionInitial(side)}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
                {showCloseButton && (
                  <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
                    <XIcon className="size-4" />
                    <span className="sr-only">Close</span>
                  </SheetPrimitive.Close>
                )}
              </motion.div>
            </SheetPrimitive.Content>
          </>
        ) : null}
      </AnimatePresence>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function sheetSideClassName(side: SheetSide) {
  if (side === "right") {
    return "fixed inset-y-0 right-0 z-50 flex h-full w-3/4 flex-col gap-4 bg-background shadow-lg sm:max-w-sm"
  }
  if (side === "left") {
    return "fixed inset-y-0 left-0 z-50 flex h-full w-3/4 flex-col gap-4 bg-background shadow-lg sm:max-w-sm"
  }
  if (side === "top") {
    return "fixed inset-x-0 top-0 z-50 flex h-auto flex-col gap-4 bg-background shadow-lg"
  }
  return "fixed inset-x-0 bottom-0 z-50 flex h-auto flex-col gap-4 bg-background shadow-lg"
}

function sheetMotionInitial(side: SheetSide) {
  if (side === "right") return { opacity: 0, x: 56, scale: 0.985 }
  if (side === "left") return { opacity: 0, x: -56, scale: 0.985 }
  if (side === "top") return { opacity: 0, y: -40, scale: 0.99 }
  return { opacity: 0, y: 40, scale: 0.99 }
}

function sheetMotionAnimate(side: SheetSide) {
  if (side === "right") return { opacity: 1, x: 0, scale: 1 }
  if (side === "left") return { opacity: 1, x: 0, scale: 1 }
  if (side === "top") return { opacity: 1, y: 0, scale: 1 }
  return { opacity: 1, y: 0, scale: 1 }
}

function sheetMotionExit(side: SheetSide) {
  if (side === "right") return { opacity: 0, x: 40, scale: 0.99 }
  if (side === "left") return { opacity: 0, x: -40, scale: 0.99 }
  if (side === "top") return { opacity: 0, y: -28, scale: 0.995 }
  return { opacity: 0, y: 28, scale: 0.995 }
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
}
