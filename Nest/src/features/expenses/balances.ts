// Pure balance computation from expense debts. All cents.
//
// A debt row means debtor owes creditor amountCents. To show a single number
// per roommate pair, we net the two directions: if Alex owes Maya $12 and Maya
// owes Alex $5, the net is "Alex owes Maya $7".

import type { ExpenseDebt, NetBalance } from "./types";

/**
 * Net all open debts that involve `currentUserId` into one balance per other
 * roommate. netCents > 0 means the other user owes the current user; < 0 means
 * the current user owes the other user; 0 means settled up.
 *
 * Only `open` debts are counted.
 */
export function netBalancesForUser(
  debts: ExpenseDebt[],
  currentUserId: string
): NetBalance[] {
  const netByOther = new Map<string, number>();
  const expensesByOther = new Map<string, Set<string>>();

  const touch = (otherId: string) => {
    if (!netByOther.has(otherId)) {
      netByOther.set(otherId, 0);
      expensesByOther.set(otherId, new Set());
    }
  };

  for (const debt of debts) {
    if (debt.status !== "open") continue;

    if (debt.creditorUserId === currentUserId) {
      // Someone owes the current user: positive.
      const other = debt.debtorUserId;
      touch(other);
      netByOther.set(other, (netByOther.get(other) ?? 0) + debt.amountCents);
      expensesByOther.get(other)!.add(debt.expenseId);
    } else if (debt.debtorUserId === currentUserId) {
      // The current user owes someone: negative.
      const other = debt.creditorUserId;
      touch(other);
      netByOther.set(other, (netByOther.get(other) ?? 0) - debt.amountCents);
      expensesByOther.get(other)!.add(debt.expenseId);
    }
  }

  const balances: NetBalance[] = [];
  for (const [otherUserId, netCents] of netByOther) {
    balances.push({
      otherUserId,
      netCents,
      expenseIds: Array.from(expensesByOther.get(otherUserId) ?? []),
    });
  }
  // Stable, useful ordering: largest amounts (owed to you) first.
  balances.sort((a, b) => b.netCents - a.netCents);
  return balances;
}
