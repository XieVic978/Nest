import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import { createRealtimeChannelName } from "@/lib/realtime";

import type { GroceryCategory, NestGroceryItem } from "./types";

type GroceryInput = {
  name: string;
  quantity: string;
  notes: string;
  category: GroceryCategory;
};

function normalizeGroceryItem(row: Record<string, unknown>): NestGroceryItem {
  const category = String(row.category ?? "other");
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    name: String(row.name),
    quantity: String(row.quantity),
    notes: String(row.notes ?? ""),
    category: `${category.slice(0, 1).toUpperCase()}${category.slice(1)}` as GroceryCategory,
    addedByUserId: String(row.added_by),
    purchasedByUserId: row.purchased_by ? String(row.purchased_by) : null,
    purchasedAt: row.purchased_at ? String(row.purchased_at) : null,
    createdAt: String(row.created_at),
  };
}

export function useGroceries(roomId: string, userId: string) {
  const [items, setItems] = useState<NestGroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error: loadError } = await client
      .from("grocery_items")
      .select("*")
      .eq("room_id", roomId)
      .order("purchased_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setItems((data ?? []).map((row) => normalizeGroceryItem(row as Record<string, unknown>)));
      setError(null);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    const channel = client
      .channel(createRealtimeChannelName(`nest-groceries-${roomId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_items", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, roomId]);

  const save = useCallback(async (input: GroceryInput, id?: string) => {
    const client = getSupabaseClient();
    const values = {
      name: input.name.trim(),
      quantity: input.quantity.trim() || "1",
      notes: input.notes.trim(),
      category: input.category.toLowerCase(),
    };
    const result = id
      ? await client.from("grocery_items").update(values).eq("id", id).eq("room_id", roomId)
      : await client.from("grocery_items").insert({ ...values, room_id: roomId, added_by: userId });
    if (result.error) throw result.error;
    await refresh();
  }, [refresh, roomId, userId]);

  const togglePurchased = useCallback(async (item: NestGroceryItem) => {
    const client = getSupabaseClient();
    const purchased = !item.purchasedByUserId;
    const { error: updateError } = await client
      .from("grocery_items")
      .update({
        purchased_by: purchased ? userId : null,
        purchased_at: purchased ? new Date().toISOString() : null,
      })
      .eq("id", item.id)
      .eq("room_id", roomId);
    if (updateError) throw updateError;
    await refresh();
  }, [refresh, roomId, userId]);

  const remove = useCallback(async (id: string) => {
    const client = getSupabaseClient();
    const { error: deleteError } = await client
      .from("grocery_items")
      .delete()
      .eq("id", id)
      .eq("room_id", roomId);
    if (deleteError) throw deleteError;
    await refresh();
  }, [refresh, roomId]);

  return { error, items, loading, refresh, remove, save, togglePurchased };
}
