import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import { createRealtimeChannelName } from "@/lib/realtime";

import type { NestAnnouncement, NestAnnouncementTarget } from "./types";

type AnnouncementInput = {
  title: string;
  pinned?: boolean;
  automated?: boolean;
  target?: NestAnnouncementTarget | null;
};

type AnnouncementStateRow = {
  announcement_id: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export function useAnnouncements(roomId: string, userId: string) {
  const [announcements, setAnnouncements] = useState<NestAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    const [announcementResult, stateResult] = await Promise.all([
      client
        .from("announcements")
        .select("*")
        .eq("room_id", roomId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      client
        .from("announcement_user_states")
        .select("announcement_id, read_at, dismissed_at")
        .eq("room_id", roomId)
        .eq("user_id", userId),
    ]);

    const loadError = announcementResult.error ?? stateResult.error;
    if (loadError) {
      setError(loadError.message);
    } else {
      const states = new Map(
        ((stateResult.data ?? []) as AnnouncementStateRow[]).map((state) => [state.announcement_id, state]),
      );
      setAnnouncements((announcementResult.data ?? []).map((row) => {
        const state = states.get(String(row.id));
        return {
          id: String(row.id),
          roomId: String(row.room_id),
          title: String(row.title),
          authorUserId: String(row.author_user_id),
          pinned: Boolean(row.pinned),
          automated: Boolean(row.automated),
          target: (row.target as NestAnnouncementTarget | null) ?? null,
          createdAt: String(row.created_at),
          read: Boolean(state?.read_at),
          dismissed: Boolean(state?.dismissed_at),
        };
      }));
      setError(null);
    }
    setLoading(false);
  }, [roomId, userId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client
      .channel(createRealtimeChannelName(`nest-announcements-${roomId}-${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcement_user_states", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, roomId, userId]);

  const publish = useCallback(async (input: AnnouncementInput) => {
    const client = getSupabaseClient();
    const { error: publishError } = await client.from("announcements").insert({
      room_id: roomId,
      title: input.title.trim(),
      author_user_id: userId,
      pinned: input.pinned ?? false,
      automated: input.automated ?? false,
      target: input.target ?? null,
    });
    if (publishError) throw publishError;
    await refresh();
  }, [refresh, roomId, userId]);

  const updateState = useCallback(async (announcementId: string, dismissed: boolean) => {
    const now = new Date().toISOString();
    const client = getSupabaseClient();
    const { error: stateError } = await client.from("announcement_user_states").upsert({
      announcement_id: announcementId,
      room_id: roomId,
      user_id: userId,
      read_at: now,
      dismissed_at: dismissed ? now : null,
    }, { onConflict: "announcement_id,user_id" });
    if (stateError) throw stateError;
    await refresh();
  }, [refresh, roomId, userId]);

  const remove = useCallback(async (id: string) => {
    const client = getSupabaseClient();
    const { data, error: deleteError } = await client
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("room_id", roomId)
      .select("id")
      .maybeSingle();
    if (deleteError) throw deleteError;
    if (!data) throw new Error("The announcement was not deleted. Only its author or a Nest admin can delete it.");
    await refresh();
  }, [refresh, roomId]);

  return {
    announcements,
    dismiss: (id: string) => updateState(id, true),
    error,
    loading,
    markRead: (id: string) => updateState(id, false),
    publish,
    refresh,
    remove,
  };
}
