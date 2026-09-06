export type ChoreRecurrence = "Once" | "Weekly" | "Every 2 weeks" | "Monthly";
export type ChorePriority = "Low" | "Normal" | "High";
export type ChoreStatus = "Upcoming" | "Completed";

export type NestChore = {
  id: string;
  roomId: string;
  title: string;
  description: string;
  assigneeUserId: string;
  due: string;
  status: ChoreStatus;
  priority: ChorePriority;
  recurrence: ChoreRecurrence;
  rotationUserIds: string[];
  displayOnCalendar: boolean;
  createdBy: string;
  completedBy: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type NestAnnouncementTarget = "chores" | "payments" | "groceries" | "calendar";

export type NestAnnouncement = {
  id: string;
  roomId: string;
  title: string;
  authorUserId: string;
  pinned: boolean;
  automated: boolean;
  target: NestAnnouncementTarget | null;
  createdAt: string;
  read: boolean;
  dismissed: boolean;
};

export type GroceryCategory = "Produce" | "Dairy" | "Pantry" | "Household" | "Other";

export type NestGroceryItem = {
  id: string;
  roomId: string;
  name: string;
  quantity: string;
  notes: string;
  category: GroceryCategory;
  addedByUserId: string;
  purchasedByUserId: string | null;
  purchasedAt: string | null;
  createdAt: string;
};

export type ExpensePaymentStatus = "open" | "pending" | "confirmed";

export type NestExpenseParticipant = {
  userId: string;
  paymentStatus: ExpensePaymentStatus;
  shareAmount: number;
};

export type NestExpense = {
  id: string;
  roomId: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  payerUserId: string;
  createdByUserId: string;
  createdAt: string;
  participants: NestExpenseParticipant[];
};

export type NestExpenseSettlement = {
  id: string;
  payerUserId: string;
  recipientUserId: string;
  amount: number;
  paymentMethod: "venmo" | "zelle" | "other";
  note: string;
  createdAt: string;
};

export type NestPaymentContact = {
  userId: string;
  fullName: string;
  phone: string | null;
  venmo: string | null;
  zelle: string | null;
};
