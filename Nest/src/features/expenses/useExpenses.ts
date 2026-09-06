import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import { createRealtimeChannelName } from "@/lib/realtime";

import { computeSplit, debtsFromShares } from "./split";
import type {
  Expense,
  ExpenseDebt,
  ExpenseDraft,
  ExpenseItem,
  ExpenseParticipant,
} from "./types";

type Row = Record<string, unknown>;

function normalizeItem(row: Row): ExpenseItem {
  return {
    id: String(row.id),
    expenseId: String(row.expense_id),
    name: String(row.name ?? ""),
    quantity: Number(row.quantity ?? 1),
    lineTotalCents: Number(row.line_total_cents ?? 0),
    assignedToUserId: row.assigned_to_user_id
      ? String(row.assigned_to_user_id)
      : null,
  };
}

function normalizeParticipant(row: Row): ExpenseParticipant {
  return {
    userId: String(row.user_id),
    finalShareCents: Number(row.final_share_cents ?? 0),
  };
}

function normalizeDebt(row: Row): ExpenseDebt {
  return {
    id: String(row.id),
    expenseId: String(row.expense_id),
    roomId: String(row.room_id),
    debtorUserId: String(row.debtor_user_id),
    creditorUserId: String(row.creditor_user_id),
    amountCents: Number(row.amount_cents ?? 0),
    status: row.status === "settled" ? "settled" : "open",
  };
}

function normalizeExpense(
  row: Row,
  items: ExpenseItem[],
  participants: ExpenseParticipant[]
): Expense {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    createdBy: String(row.created_by),
    paidBy: String(row.paid_by),
    merchant: String(row.merchant ?? ""),
    purchasedAt: row.purchased_at ? String(row.purchased_at) : null,
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    tipCents: Number(row.tip_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    receiptImagePath: row.receipt_image_path
      ? String(row.receipt_image_path)
      : null,
    createdAt: String(row.created_at),
    items,
    participants,
  };
}

export function useExpenses(roomId: string, userId: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<ExpenseDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    try {
      const [expenseRes, itemRes, participantRes, debtRes] = await Promise.all([
        client
          .from("expenses")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false }),
        client.from("expense_items").select("*"),
        client.from("expense_participants").select("*"),
        client.from("expense_debts").select("*").eq("room_id", roomId),
      ]);

      const firstError =
        expenseRes.error ??
        itemRes.error ??
        participantRes.error ??
        debtRes.error;
      if (firstError) throw firstError;

      // Group items/participants by expense id. RLS already limits these to
      // expenses the user can see, so filtering by the room's expense ids is
      // just for correct grouping.
      const itemsByExpense = new Map<string, ExpenseItem[]>();
      for (const raw of itemRes.data ?? []) {
        const item = normalizeItem(raw as Row);
        const list = itemsByExpense.get(item.expenseId) ?? [];
        list.push(item);
        itemsByExpense.set(item.expenseId, list);
      }
      const participantsByExpense = new Map<string, ExpenseParticipant[]>();
      for (const raw of participantRes.data ?? []) {
        const p = normalizeParticipant(raw as Row);
        const key = String((raw as Row).expense_id);
        const list = participantsByExpense.get(key) ?? [];
        list.push(p);
        participantsByExpense.set(key, list);
      }

      const normalized = (expenseRes.data ?? []).map((raw) => {
        const id = String((raw as Row).id);
        return normalizeExpense(
          raw as Row,
          itemsByExpense.get(id) ?? [],
          participantsByExpense.get(id) ?? []
        );
      });

      setExpenses(normalized);
      setDebts((debtRes.data ?? []).map((raw) => normalizeDebt(raw as Row)));
      setError(null);
    } catch (caught) {
      setError(
        caught && typeof caught === "object" && "message" in caught
          ? String((caught as { message: unknown }).message)
          : "Could not load expenses."
      );
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client
      .channel(createRealtimeChannelName(`nest-expenses-${roomId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `room_id=eq.${roomId}` },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expense_debts", filter: `room_id=eq.${roomId}` },
        () => void refresh()
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, roomId]);

  /**
   * Save a reviewed receipt as an expense. Computes the split in cents, then
   * inserts the expense, its items, participants, and debts. Returns the new
   * expense id on success.
   *
   * Note: supabase-js has no client transaction, so inserts are sequential. If
   * a later insert fails, we roll back by deleting the parent expense (its
   * children cascade), so we never leave a half-saved expense.
   */
  const saveExpense = useCallback(
    async (draft: ExpenseDraft): Promise<string> => {
      const client = getSupabaseClient();

      const split = computeSplit({
        totalCents: draft.totalCents,
        participantIds: draft.participantIds,
        items: draft.items.map((item) => ({
          lineTotalCents: item.lineTotalCents,
          assignedToUserId: item.assignedToUserId,
        })),
      });
      if (!split.ok) throw new Error(split.error);

      const debtRows = debtsFromShares(split.result.shares, draft.paidByUserId);

      // 1. Insert the expense.
      const { data: expenseData, error: expenseError } = await client
        .from("expenses")
        .insert({
          room_id: roomId,
          created_by: userId,
          paid_by: draft.paidByUserId,
          merchant: draft.merchant.trim(),
          purchased_at: draft.purchasedAt,
          subtotal_cents: draft.subtotalCents,
          tax_cents: draft.taxCents,
          tip_cents: draft.tipCents,
          total_cents: draft.totalCents,
          receipt_image_path: draft.receiptImagePath,
        })
        .select("id")
        .single();
      if (expenseError) throw expenseError;
      const expenseId = String((expenseData as Row).id);

      try {
        // 2. Items.
        if (draft.items.length > 0) {
          const { error: itemsError } = await client.from("expense_items").insert(
            draft.items.map((item) => ({
              expense_id: expenseId,
              name: item.name.trim(),
              quantity: item.quantity,
              line_total_cents: item.lineTotalCents,
              assigned_to_user_id: item.assignedToUserId,
            }))
          );
          if (itemsError) throw itemsError;
        }

        // 3. Participants (final shares).
        const { error: participantsError } = await client
          .from("expense_participants")
          .insert(
            split.result.shares.map((share) => ({
              expense_id: expenseId,
              user_id: share.userId,
              final_share_cents: share.finalShareCents,
            }))
          );
        if (participantsError) throw participantsError;

        // 4. Debts (only for non-payers who owe > 0).
        if (debtRows.length > 0) {
          const { error: debtsError } = await client
            .from("expense_debts")
            .insert(
              debtRows.map((debt) => ({
                expense_id: expenseId,
                room_id: roomId,
                debtor_user_id: debt.debtorUserId,
                creditor_user_id: debt.creditorUserId,
                amount_cents: debt.amountCents,
                status: "open",
              }))
            );
          if (debtsError) throw debtsError;
        }
      } catch (caught) {
        // Roll back the parent so we never leave a half-saved expense.
        await client.from("expenses").delete().eq("id", expenseId);
        throw caught;
      }

      await refresh();
      return expenseId;
    },
    [refresh, roomId, userId]
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      const client = getSupabaseClient();
      const { error: deleteError } = await client
        .from("expenses")
        .delete()
        .eq("id", expenseId)
        .eq("room_id", roomId);
      if (deleteError) throw deleteError;
      await refresh();
    },
    [refresh, roomId]
  );

  // Create a short-lived signed URL for a private receipt image.
  const getReceiptUrl = useCallback(
    async (path: string): Promise<string | null> => {
      const client = getSupabaseClient();
      const { data, error: urlError } = await client.storage
        .from("receipts")
        .createSignedUrl(path, 60 * 60);
      if (urlError) return null;
      return data?.signedUrl ?? null;
    },
    []
  );

  return {
    expenses,
    debts,
    loading,
    error,
    refresh,
    saveExpense,
    deleteExpense,
    getReceiptUrl,
  };
}
