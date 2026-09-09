"use client";

import { formatMoney, toSecondary } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  amount: number;
  currency: string;
  secondaryCurrency?: string | null;
  fxRate?: number;
  className?: string;
  /** Show secondary as primary (teal) when true — dual currency display */
  emphasizeSecondary?: boolean;
};

export function Money({
  amount,
  currency,
  secondaryCurrency,
  fxRate = 1,
  className,
  emphasizeSecondary = true,
}: Props) {
  const secondary =
    secondaryCurrency && fxRate > 0
      ? toSecondary(amount, fxRate)
      : null;

  if (emphasizeSecondary && secondary !== null && secondaryCurrency) {
    return (
      <div className={cn("leading-tight", className)}>
        <p className="font-semibold text-teal-400">
          {formatMoney(secondary, secondaryCurrency)}
        </p>
        <p className="text-xs text-gray-500">{formatMoney(amount, currency)}</p>
      </div>
    );
  }

  return (
    <div className={cn("leading-tight", className)}>
      <p className="font-semibold text-teal-400">{formatMoney(amount, currency)}</p>
      {secondary !== null && secondaryCurrency ? (
        <p className="text-xs text-gray-500">
          {formatMoney(secondary, secondaryCurrency)}
        </p>
      ) : null}
    </div>
  );
}
