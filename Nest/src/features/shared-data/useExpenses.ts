import { useCallback, useEffect, useState } from "react";

import { createRealtimeChannelName } from "@/lib/realtime";
import { getSupabaseClient } from "@/lib/supabase";

import type { ExpensePaymentStatus, NestExpense, NestExpenseParticipant, NestExpenseSettlement, NestPaymentContact } from "./types";

export type ExpenseInput = {
  title: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  payerUserId: string;
  participantUserIds: string[];
};

export type ReceiptExpenseInput = {
  title: string;
  amount: number;
  date: string;
  description: string;
  participantUserIds: string[];
  items: { name: string; amount: number; assignedUserId: string | null }[];
  imagePath?: string | null;
};

type ParticipantRow = {
  user_id: string;
  payment_status: ExpensePaymentStatus;
  share_amount: number | string | null;
};

type SettlementRow = {
  id: string;
  payer_user_id: string;
  recipient_user_id: string;
  amount: number | string;
  payment_method: "venmo" | "zelle" | "other";
  note: string | null;
  created_at: string;
};

function normalizeExpense(row: Record<string, unknown>): NestExpense {
  const participantRows = Array.isArray(row.nest_expense_participants)
    ? (row.nest_expense_participants as ParticipantRow[])
    : [];
  const participants: NestExpenseParticipant[] = participantRows.map((participant) => ({
    userId: String(participant.user_id),
    paymentStatus: participant.payment_status,
    shareAmount: Number(participant.share_amount ?? 0),
  }));

  return {
    id: String(row.id),
    roomId: String(row.room_id),
    title: String(row.title),
    amount: Number(row.amount),
    date: String(row.expense_date),
    category: `${String(row.category).slice(0, 1).toUpperCase()}${String(row.category).slice(1)}`,
    description: String(row.description ?? ""),
    payerUserId: String(row.payer_user_id),
    createdByUserId: String(row.created_by),
    createdAt: String(row.created_at),
    participants,
  };
}

export function useExpenses(roomId: string) {
  const [expenses, setExpenses] = useState<NestExpense[]>([]);
  const [settlements, setSettlements] = useState<NestExpenseSettlement[]>([]);
  const [contacts, setContacts] = useState<NestPaymentContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error: loadError } = await client
      .from("nest_expenses")
      .select("*, nest_expense_participants(user_id, payment_status, share_amount)")
      .eq("room_id", roomId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    const [{ data: settlementData, error: settlementError }, { data: contactData, error: contactError }] = await Promise.all([
      client.from("nest_expense_settlements").select("id, payer_user_id, recipient_user_id, amount, payment_method, note, created_at").eq("room_id", roomId).order("created_at", { ascending: false }),
      client.rpc("get_nest_payment_contacts", { p_room_id: roomId }),
    ]);

    if (loadError || settlementError || contactError) {
      setError(loadError?.message ?? settlementError?.message ?? contactError?.message ?? "Couldn’t load expenses.");
    } else {
      setExpenses((data ?? []).map((row) => normalizeExpense(row as Record<string, unknown>)));
      setSettlements((settlementData ?? []).map((row) => {
        const settlement = row as SettlementRow;
        return { id: settlement.id, payerUserId: settlement.payer_user_id, recipientUserId: settlement.recipient_user_id, amount: Number(settlement.amount), paymentMethod: settlement.payment_method, note: settlement.note ?? "", createdAt: settlement.created_at };
      }));
      setContacts((contactData ?? []).map((row: unknown) => {
        const contact = row as Record<string, unknown>;
        return { userId: String(contact.user_id), fullName: String(contact.full_name), phone: typeof contact.phone === "string" ? contact.phone : null, venmo: typeof contact.venmo === "string" ? contact.venmo : null, zelle: typeof contact.zelle === "string" ? contact.zelle : null };
      }));
      setError(null);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client
      .channel(createRealtimeChannelName(`nest-expenses-${roomId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nest_expenses", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nest_expense_settlements", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nest_expense_participants", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, roomId]);

  const createExpense = useCallback(async (input: ExpenseInput) => {
    const client = getSupabaseClient();
    const { error: createError } = await client.rpc("create_nest_expense", {
      p_room_id: roomId,
      p_title: input.title.trim(),
      p_amount: input.amount,
      p_expense_date: input.date,
      p_category: input.category.toLowerCase(),
      p_description: input.description.trim(),
      p_payer_user_id: input.payerUserId,
      p_participant_user_ids: input.participantUserIds,
    });
    if (createError) throw createError;
    await refresh();
  }, [refresh, roomId]);

  const setPaymentStatus = useCallback(async (
    expenseId: string,
    participantUserId: string,
    status: ExpensePaymentStatus,
  ) => {
    const client = getSupabaseClient();
    const { error: updateError } = await client.rpc("set_nest_expense_payment_status", {
      p_expense_id: expenseId,
      p_user_id: participantUserId,
      p_status: status,
    });
    if (updateError) throw updateError;
    await refresh();
  }, [refresh]);

  const createReceiptExpense = useCallback(async (input: ReceiptExpenseInput) => {
    const client = getSupabaseClient();
    const { error: receiptError } = await client.rpc("create_nest_receipt_expense", {
      p_room_id: roomId,
      p_title: input.title.trim(),
      p_amount: input.amount,
      p_expense_date: input.date,
      p_description: input.description.trim(),
      p_participant_user_ids: input.participantUserIds,
      p_items: input.items.map((item) => ({ name: item.name.trim(), amount: item.amount, assignedUserId: item.assignedUserId })),
      p_image_path: input.imagePath ?? null,
    });
    if (receiptError) throw receiptError;
    await refresh();
  }, [refresh, roomId]);

  const removeExpense = useCallback(async (expenseId: string) => {
    const { error: deleteError } = await getSupabaseClient().rpc("delete_nest_expense", { p_expense_id: expenseId });
    if (deleteError) throw deleteError;
    await refresh();
  }, [refresh]);

  const recordSettlement = useCallback(async (
    recipientUserId: string,
    amount: number,
    paymentMethod: "venmo" | "zelle" | "other",
    note: string,
  ) => {
    const client = getSupabaseClient();
    const { error: settlementError } = await client.rpc("record_nest_expense_settlement", {
      p_room_id: roomId,
      p_recipient_user_id: recipientUserId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_note: note,
    });
    if (settlementError) throw settlementError;
    await refresh();
  }, [refresh, roomId]);

  return { contacts, createExpense, createReceiptExpense, error, expenses, loading, recordSettlement, refresh, removeExpense, settlements, setPaymentStatus };
}
