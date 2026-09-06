import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import { createRealtimeChannelName } from "@/lib/realtime";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  start: string;
  startTime: string;
  end: string;
  endTime: string;
  location: string;
  attendees: string[];
  category: "Household" | "Guest" | "Travel" | "Bill" | "Chore" | "Availability";
  allDay: boolean;
  authorUserId: string;
  sourceChoreId: string | null;
};

type CalendarEventInput = Omit<CalendarEvent, "id" | "authorUserId" | "sourceChoreId">;

const categories: Record<string, CalendarEvent["category"]> = {
  household: "Household", guest: "Guest", travel: "Travel", bill: "Bill", chore: "Chore", availability: "Availability",
};

function normalize(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id), title: String(row.title), description: String(row.description ?? ""),
    start: String(row.start_date), startTime: String(row.start_time), end: String(row.end_date), endTime: String(row.end_time),
    location: String(row.location ?? ""), attendees: Array.isArray(row.attendee_names) ? row.attendee_names.map(String) : [],
    category: categories[String(row.category)] ?? "Household", allDay: Boolean(row.all_day),
    authorUserId: String(row.created_by), sourceChoreId: row.source_chore_id ? String(row.source_chore_id) : null,
  };
}

export function useCalendarEvents(roomId: string, userId: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: loadError } = await getSupabaseClient().from("calendar_events").select("*").eq("room_id", roomId).order("start_date");
    if (loadError) setError(loadError.message);
    else { setEvents((data ?? []).map((row) => normalize(row as Record<string, unknown>))); setError(null); }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client.channel(createRealtimeChannelName(`nest-calendar-${roomId}`)).on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `room_id=eq.${roomId}` }, () => void refresh()).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [refresh, roomId]);

  const save = useCallback(async (event: CalendarEventInput, id?: string) => {
    const values = { title: event.title.trim(), description: event.description.trim(), start_date: event.start, start_time: event.startTime, end_date: event.end, end_time: event.endTime, location: event.location.trim(), attendee_names: event.attendees, category: event.category.toLowerCase(), all_day: event.allDay };
    const result = id
      ? await getSupabaseClient().from("calendar_events").update(values).eq("id", id).eq("room_id", roomId).is("source_chore_id", null)
      : await getSupabaseClient().from("calendar_events").insert({ ...values, room_id: roomId, created_by: userId });
    if (result.error) throw result.error;
    await refresh();
  }, [refresh, roomId, userId]);

  const remove = useCallback(async (id: string) => {
    const { error: deleteError } = await getSupabaseClient().from("calendar_events").delete().eq("id", id).eq("room_id", roomId).is("source_chore_id", null);
    if (deleteError) throw deleteError;
    await refresh();
  }, [refresh, roomId]);

  return { error, events, loading, refresh, remove, save };
}
