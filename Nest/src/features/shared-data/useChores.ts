import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import { createRealtimeChannelName } from "@/lib/realtime";

import type { ChorePriority, ChoreRecurrence, NestChore } from "./types";

type ChoreInput = {
  title: string;
  description: string;
  assigneeUserId: string;
  due: string;
  priority: ChorePriority;
  recurrence: ChoreRecurrence;
  rotationUserIds: string[];
};

const recurrenceToDatabase: Record<ChoreRecurrence, string> = {
  Once: "once",
  Weekly: "weekly",
  "Every 2 weeks": "biweekly",
  Monthly: "monthly",
};

const recurrenceFromDatabase: Record<string, ChoreRecurrence> = {
  once: "Once",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

function normalizeChore(row: Record<string, unknown>): NestChore {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    assigneeUserId: String(row.assignee_user_id),
    due: String(row.due_date),
    status: row.status === "completed" ? "Completed" : "Upcoming",
    priority: `${String(row.priority).slice(0, 1).toUpperCase()}${String(row.priority).slice(1)}` as ChorePriority,
    recurrence: recurrenceFromDatabase[String(row.recurrence)] ?? "Once",
    rotationUserIds: Array.isArray(row.rotation_user_ids) ? row.rotation_user_ids.map(String) : [],
    createdBy: String(row.created_by),
    completedBy: row.completed_by ? String(row.completed_by) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
  };
}

export function useChores(roomId: string, userId: string) {
  const [chores, setChores] = useState<NestChore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error: loadError } = await client
      .from("chores")
      .select("*")
      .eq("room_id", roomId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setChores((data ?? []).map((row) => normalizeChore(row as Record<string, unknown>)));
      setError(null);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client
      .channel(createRealtimeChannelName(`nest-chores-${roomId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chores", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, roomId]);

  const save = useCallback(async (input: ChoreInput, id?: string) => {
    const client = getSupabaseClient();
    const values = {
      title: input.title.trim(),
      description: input.description.trim(),
      assignee_user_id: input.assigneeUserId,
      due_date: input.due,
      priority: input.priority.toLowerCase(),
      recurrence: recurrenceToDatabase[input.recurrence],
      rotation_user_ids: input.rotationUserIds,
    };
    const result = id
      ? await client.from("chores").update(values).eq("id", id).eq("room_id", roomId)
      : await client.from("chores").insert({ ...values, room_id: roomId, created_by: userId });
    if (result.error) throw result.error;
    await refresh();
  }, [refresh, roomId, userId]);

  const complete = useCallback(async (id: string) => {
    const client = getSupabaseClient();
    const { error: completeError } = await client.rpc("complete_nest_chore", { p_chore_id: id });
    if (completeError) throw completeError;
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const client = getSupabaseClient();
    const { error: deleteError } = await client.from("chores").delete().eq("id", id).eq("room_id", roomId);
    if (deleteError) throw deleteError;
    await refresh();
  }, [refresh, roomId]);

  return { chores, complete, error, loading, refresh, remove, save };
}
