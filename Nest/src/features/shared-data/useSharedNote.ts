import { useCallback, useEffect, useState } from "react";

import { createRealtimeChannelName } from "@/lib/realtime";
import { getSupabaseClient } from "@/lib/supabase";

export type SharedNote = { id: string; content: string; updatedAt: string };

function toNote(row: Record<string, unknown>): SharedNote {
  return { id: String(row.id), content: String(row.content ?? ""), updatedAt: String(row.updated_at) };
}

export function useSharedNote(roomId: string, userId: string) {
  const [note, setNote] = useState<SharedNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: loadError } = await getSupabaseClient()
      .from("shared_notes")
      .select("id, content, updated_at")
      .eq("room_id", roomId)
      .maybeSingle();
    if (loadError) setError(loadError.message);
    else { setNote(data ? toNote(data as Record<string, unknown>) : null); setError(null); }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client
      .channel(createRealtimeChannelName(`nest-note-${roomId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_notes", filter: `room_id=eq.${roomId}` }, () => void refresh())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [refresh, roomId]);

  const saveContent = useCallback(async (content: string) => {
    const client = getSupabaseClient();
    if (note) {
      const { error: updateError } = await client.from("shared_notes").update({ content }).eq("id", note.id).eq("room_id", roomId);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await client.from("shared_notes").insert({
        room_id: roomId, title: "Nest notes", content, created_by: userId, updated_by: userId,
      });
      if (insertError) throw insertError;
    }
    await refresh();
  }, [note, refresh, roomId, userId]);

  return { error, loading, note, refresh, saveContent };
}
