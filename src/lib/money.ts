export function formatMoney(amount: number, code = "PKR") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}

/** fxRate = base units per 1 secondary (e.g. 250 PKR per 1 USD) */
export function toSecondary(amountBase: number, fxRate: number) {
  if (!fxRate || fxRate <= 0) return 0;
  return Math.round((amountBase / fxRate) * 100) / 100;
}

export function toBase(amountSecondary: number, fxRate: number) {
  return Math.round(amountSecondary * fxRate * 100) / 100;
}
