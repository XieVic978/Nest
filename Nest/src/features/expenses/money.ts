// Money helpers. All money in the app is integer cents; these convert to/from
// the dollar strings shown in the UI without ever doing float math on stored
// values.

// Parse a user-entered dollar string (e.g. "12.5", "$1,234.00") into integer
// cents. Returns null if it isn't a valid non-negative amount.
export function dollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d*\.?\d{0,2}$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  // Round to the nearest cent to avoid binary float drift, then to integer.
  return Math.round(value * 100);
}

// Format integer cents as a dollar string, e.g. 1234 -> "12.34".
export function centsToDollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, "0");
  return `${sign}${dollars}.${remainder}`;
}

// Format integer cents for display with a leading "$", e.g. 1234 -> "$12.34".
export function formatCents(cents: number): string {
  return `$${centsToDollars(cents)}`;
}
