import { useCallback, useEffect, useState } from "react";

import { createRealtimeChannelName } from "@/lib/realtime";
import { getSupabaseClient } from "@/lib/supabase";

import type { ExpensePaymentStatus, NestExpense, NestExpenseParticipant } from "./types";

export type ExpenseInput = {
  title: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  payerUserId: string;
  participantUserIds: string[];
};

type ParticipantRow = {
  user_id: string;
  payment_status: ExpensePaymentStatus;
};

function normalizeExpense(row: Record<string, unknown>): NestExpense {
  const participantRows = Array.isArray(row.nest_expense_participants)
    ? (row.nest_expense_participants as ParticipantRow[])
    : [];
  const participants: NestExpenseParticipant[] = participantRows.map((participant) => ({
    userId: String(participant.user_id),
    paymentStatus: participant.payment_status,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error: loadError } = await client
      .from("nest_expenses")
      .select("*, nest_expense_participants(user_id, payment_status)")
      .eq("room_id", roomId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setExpenses((data ?? []).map((row) => normalizeExpense(row as Record<string, unknown>)));
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

  return { createExpense, error, expenses, loading, refresh, setPaymentStatus };
}
