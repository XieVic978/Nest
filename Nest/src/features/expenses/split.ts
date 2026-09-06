// Pure split-calculation logic for Receipt Scan & Split.
//
// Everything is integer cents. No floating point is ever used for money.
// The functions here are pure and deterministic so the result always
// reconciles exactly to the receipt grand total.

export type SplitItem = {
  // Full line total for the item, in cents.
  lineTotalCents: number;
  // Participant user id this item is exclusively charged to, or null = shared.
  assignedToUserId: string | null;
};

export type SplitInput = {
  // Receipt grand total, in cents. This is the amount that must be reconciled.
  totalCents: number;
  // The roommates included in this split (user ids).
  participantIds: string[];
  // The line items.
  items: SplitItem[];
};

export type SplitShare = {
  userId: string;
  // exclusive item total + equal share of the shared pool, in cents.
  finalShareCents: number;
};

export type SplitResult = {
  shares: SplitShare[];
  exclusiveTotalByUser: Record<string, number>;
  sharedPoolCents: number;
};

export type SplitError =
  | { ok: false; error: string }
  | { ok: true; result: SplitResult };

// Sum of all items exclusively assigned to a given participant.
function exclusiveTotals(
  items: SplitItem[],
  participantIds: string[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of participantIds) totals[id] = 0;
  for (const item of items) {
    const assignee = item.assignedToUserId;
    if (assignee && assignee in totals) {
      totals[assignee] += item.lineTotalCents;
    }
  }
  return totals;
}

/**
 * Distribute `totalCents` as evenly as possible across `count` participants,
 * returning an array of integer cents that sums EXACTLY to `totalCents`.
 * Remainder cents are handed out one-by-one to the first participants, so the
 * result is deterministic given a fixed participant ordering.
 */
export function distributeEvenly(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  let remainder = totalCents - base * count; // 0 <= remainder < count
  const shares: number[] = [];
  for (let i = 0; i < count; i++) {
    shares.push(base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder -= 1;
  }
  return shares;
}

/**
 * Compute each participant's final share in cents. Guarantees the shares sum
 * exactly to `totalCents`.
 *
 * - exclusiveTotal[user] = sum of items assigned only to that user.
 * - sharedPool = total - sum(all exclusive item totals).
 * - sharedPool is split evenly across all participants (remainder distributed
 *   deterministically).
 * - final share = exclusive total + equal share of shared pool.
 */
export function computeSplit(input: SplitInput): SplitError {
  const { totalCents, participantIds, items } = input;

  if (!Number.isInteger(totalCents) || totalCents < 0) {
    return { ok: false, error: "Total must be a whole number of cents." };
  }
  if (participantIds.length === 0) {
    return { ok: false, error: "Select at least one roommate to split with." };
  }

  const exclusiveByUser = exclusiveTotals(items, participantIds);
  const exclusiveSum = Object.values(exclusiveByUser).reduce(
    (sum, cents) => sum + cents,
    0
  );

  if (exclusiveSum > totalCents) {
    return {
      ok: false,
      error:
        "Assigned items add up to more than the receipt total. Adjust the items or the total.",
    };
  }

  const sharedPool = totalCents - exclusiveSum;
  const poolShares = distributeEvenly(sharedPool, participantIds.length);

  const shares: SplitShare[] = participantIds.map((userId, index) => ({
    userId,
    finalShareCents: exclusiveByUser[userId] + poolShares[index],
  }));

  return {
    ok: true,
    result: {
      shares,
      exclusiveTotalByUser: exclusiveByUser,
      sharedPoolCents: sharedPool,
    },
  };
}

export type Debt = {
  debtorUserId: string;
  creditorUserId: string;
  amountCents: number;
};

/**
 * Turn computed shares into debts owed to the payer. The payer never owes
 * themselves; every other participant owes their final share to the payer.
 */
export function debtsFromShares(
  shares: SplitShare[],
  payerUserId: string
): Debt[] {
  const debts: Debt[] = [];
  for (const share of shares) {
    if (share.userId === payerUserId) continue;
    if (share.finalShareCents <= 0) continue;
    debts.push({
      debtorUserId: share.userId,
      creditorUserId: payerUserId,
      amountCents: share.finalShareCents,
    });
  }
  return debts;
}
