import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/media/logo-mark.svg"
      alt=""
      width={36}
      height={36}
      className={cn("h-9 w-9 shrink-0 object-contain", className)}
      aria-hidden
    />
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/media/word-mark.svg"
      alt="Figics workforce"
      width={140}
      height={60}
      className={cn("h-8 w-auto max-w-[9.5rem] object-contain object-left", className)}
    />
  );
}

export function BrandLockup({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark />
      {!compact ? <LogoWordmark /> : null}
    </div>
  );
}
