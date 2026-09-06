// Domain types for the Receipt Scan & Split feature. All money is integer cents.

export type ExpenseItem = {
  id: string;
  expenseId: string;
  name: string;
  quantity: number;
  lineTotalCents: number;
  // null => shared among all participants; a user id => exclusive to that user.
  assignedToUserId: string | null;
};

export type ExpenseParticipant = {
  userId: string;
  finalShareCents: number;
};

export type ExpenseDebtStatus = "open" | "settled";

export type ExpenseDebt = {
  id: string;
  expenseId: string;
  roomId: string;
  debtorUserId: string;
  creditorUserId: string;
  amountCents: number;
  status: ExpenseDebtStatus;
};

export type Expense = {
  id: string;
  roomId: string;
  createdBy: string;
  paidBy: string;
  merchant: string;
  purchasedAt: string | null;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  receiptImagePath: string | null;
  createdAt: string;
  items: ExpenseItem[];
  participants: ExpenseParticipant[];
};

// A draft (unsaved) item used on the Review screen before saving.
export type DraftItem = {
  // Local-only id for list keys before the row exists in the database.
  key: string;
  name: string;
  quantity: number;
  lineTotalCents: number;
  assignedToUserId: string | null;
};

// The full payload the Review screen hands to the save function.
export type ExpenseDraft = {
  merchant: string;
  purchasedAt: string | null;
  paidByUserId: string;
  participantIds: string[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  items: DraftItem[];
  receiptImagePath: string | null;
};

// Shape returned by the scan-receipt Edge Function (already normalized to cents).
export type ScanResult = {
  merchant: string;
  purchasedAt: string | null;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  items: { name: string; quantity: number; lineTotalCents: number }[];
};

// A netted balance between the current user and one other roommate.
export type NetBalance = {
  otherUserId: string;
  // > 0: the other user owes the current user; < 0: current user owes them.
  netCents: number;
  // Expenses that contributed to this pair's balance.
  expenseIds: string[];
};
