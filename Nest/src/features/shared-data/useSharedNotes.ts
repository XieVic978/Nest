import { useCallback, useEffect, useState } from "react";

import { createRealtimeChannelName } from "@/lib/realtime";
import { getSupabaseClient } from "@/lib/supabase";

export type SharedNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

type NoteInput = Pick<SharedNote, "content" | "title">;

function toNote(row: Record<string, unknown>): SharedNote {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    updatedBy: String(row.updated_by),
  };
}

export function useSharedNotes(roomId: string, userId: string) {
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: loadError } = await getSupabaseClient()
      .from("shared_notes")
      .select("id, title, content, created_at, updated_at, updated_by")
      .eq("room_id", roomId)
      .order("updated_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else {
      setNotes((data ?? []).map((row) => toNote(row as Record<string, unknown>)));
      setError(null);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client
      .channel(createRealtimeChannelName(`nest-notes-${roomId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_notes", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [refresh, roomId]);

  const create = useCallback(async (input: NoteInput) => {
    const { error: createError } = await getSupabaseClient().from("shared_notes").insert({
      room_id: roomId,
      title: input.title.trim() || "Untitled note",
      content: input.content,
      created_by: userId,
      updated_by: userId,
    });
    if (createError) throw createError;
    await refresh();
  }, [refresh, roomId, userId]);

  const save = useCallback(async (id: string, input: NoteInput) => {
    const { error: saveError } = await getSupabaseClient().from("shared_notes").update({
      title: input.title.trim() || "Untitled note",
      content: input.content,
    }).eq("id", id).eq("room_id", roomId);
    if (saveError) throw saveError;
    await refresh();
  }, [refresh, roomId]);

  const remove = useCallback(async (id: string) => {
    const { error: deleteError } = await getSupabaseClient().from("shared_notes").delete().eq("id", id).eq("room_id", roomId);
    if (deleteError) throw deleteError;
    await refresh();
  }, [refresh, roomId]);

  return { create, error, loading, notes, refresh, remove, save };
}
