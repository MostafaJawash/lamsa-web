import { cn } from "@/lib/utils";

/** Centered page width with the standard side padding (logical, RTL-safe). */
export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
      {...props}
    />
  );
}
